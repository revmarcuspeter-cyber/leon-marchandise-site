const MAX_BODY_BYTES = 1_000_000;
const TOLERANCE_SECONDS = 300;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

async function readLimitedBody(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return ""; }
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!header || !secret || header.length > 4096) return false;
  const values = new Map();
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    const list = values.get(key) || [];
    list.push(value);
    values.set(key, list);
  }
  const timestamp = Number(values.get("t")?.[0]);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return (values.get("v1") || []).some((signature) => /^[0-9a-f]{64}$/i.test(signature) && safeEqual(signature.toLowerCase(), expected));
}

export async function onRequestPost({ request, env }) {
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);
  if (!env.DB || !env.STRIPE_WEBHOOK_SECRET) return json({ error: "Webhook is not configured" }, 503);
  const rawBody = await readLimitedBody(request, MAX_BODY_BYTES);
  if (rawBody === null) return json({ error: "Request too large" }, 413);
  if (!await verifyStripeSignature(rawBody, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET)) return json({ error: "Invalid webhook signature" }, 400);

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Invalid event payload" }, 400); }
  if (typeof event?.id !== "string" || !/^[a-zA-Z0-9_]{1,255}$/.test(event.id) || typeof event?.type !== "string" || event.type.length > 255) return json({ error: "Invalid event" }, 400);

  const session = event.data?.object;
  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
      session?.mode === "payment" && session?.payment_status === "paid" &&
      typeof session.id === "string" && /^[a-zA-Z0-9_]{1,255}$/.test(session.id) &&
      Number.isSafeInteger(session.amount_total) && session.currency === "gbp") {
    await env.DB.prepare("UPDATE orders SET status = 'paid', paid_at = ?, customer_email = COALESCE(?, customer_email) WHERE stripe_session_id = ? AND status = 'pending' AND amount_total = ? AND currency = 'gbp'")
      .bind(new Date().toISOString(), typeof session.customer_details?.email === "string" ? session.customer_details.email.slice(0, 320) : null, session.id, session.amount_total).run();
  } else if ((event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") &&
      typeof session?.id === "string" && /^[a-zA-Z0-9_]{1,255}$/.test(session.id)) {
    await env.DB.prepare("UPDATE orders SET status = 'cancelled' WHERE stripe_session_id = ? AND status = 'pending'").bind(session.id).run();
  }

  // Record after the idempotent order update, so Stripe retries if D1 temporarily fails.
  await env.DB.prepare("INSERT OR IGNORE INTO stripe_events (id, type, received_at) VALUES (?, ?, ?)")
    .bind(event.id, event.type, new Date().toISOString()).run();
  return json({ received: true });
}
