const ALLOWED_ORIGIN = "https://leonmarchandise.co.uk";
const MAX_BODY_BYTES = 16_384;
const MAX_LINE_ITEMS = 20;
const MAX_QUANTITY = 10;
const MAX_PRICE_PENCE = 1_000_000;
const MAX_ORDER_PENCE = 5_000_000;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders }
  });
}

function corsHeaders(origin, methods = "POST, OPTIONS") {
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": methods, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
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
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
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

function normalizeLines(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_LINE_ITEMS) return null;
  const seen = new Set();
  const lines = [];
  for (const item of value) {
    if (!item || typeof item.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(item.id)) return null;
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || seen.has(item.id)) return null;
    seen.add(item.id);
    lines.push({ id: item.id, quantity });
  }
  return lines;
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin");
  if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin, "GET, POST, OPTIONS") });
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403);
  const headers = origin === ALLOWED_ORIGIN ? corsHeaders(origin, "GET, POST, OPTIONS") : {};
  return json({ available: Boolean(env.DB && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) }, 200, headers);
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403);
  const headers = corsHeaders(origin, "GET, POST, OPTIONS");
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return json({ error: "Expected application/json" }, 415, headers);
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413, headers);
  const rawBody = await readLimitedBody(request, MAX_BODY_BYTES);
  if (rawBody === null) return json({ error: "Request too large" }, 413, headers);
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON" }, 400, headers); }
  const lines = normalizeLines(payload?.items);
  if (!lines) return json({ error: "Invalid cart" }, 400, headers);
  if (!env.DB || !env.STRIPE_SECRET_KEY) return json({ error: "Checkout is not configured" }, 503, headers);

  try {
    await env.DB.prepare("SELECT 1 FROM products LIMIT 1").first();
  } catch {
    return json({ error: "Product catalogue is not configured" }, 503, headers);
  }

  const placeholders = lines.map(() => "?").join(",");
  const rows = await env.DB.prepare(`SELECT id, name, price_pence, active FROM products WHERE id IN (${placeholders})`).bind(...lines.map((line) => line.id)).all();
  const productById = new Map((rows.results || []).map((row) => [row.id, row]));
  const stripeItems = [];
  let totalPence = 0;
  for (const line of lines) {
    const product = productById.get(line.id);
    if (!product || product.active !== 1 || !Number.isInteger(product.price_pence) || product.price_pence < 1 || product.price_pence > MAX_PRICE_PENCE) return json({ error: "One or more products are unavailable" }, 400, headers);
    totalPence += product.price_pence * line.quantity;
    if (!Number.isSafeInteger(totalPence) || totalPence > MAX_ORDER_PENCE) return json({ error: "Cart total is too high" }, 400, headers);
    stripeItems.push({ name: product.name, price: product.price_pence, quantity: line.quantity });
  }

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${ALLOWED_ORIGIN}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${ALLOWED_ORIGIN}/store/?checkout=cancelled`);
  stripeItems.forEach((item, index) => {
    form.set(`line_items[${index}][price_data][currency]`, "gbp");
    form.set(`line_items[${index}][price_data][unit_amount]`, String(item.price));
    form.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    form.set(`line_items[${index}][quantity]`, String(item.quantity));
  });

  let stripeResponse;
  try {
    stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
  } catch { return json({ error: "Payment provider unavailable" }, 502, headers); }
  const session = await stripeResponse.json().catch(() => null);
  let checkoutUrl;
  try { checkoutUrl = new URL(session?.url); } catch { return json({ error: "Could not create checkout session" }, 502, headers); }
  if (!stripeResponse.ok || typeof session?.id !== "string" || checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") return json({ error: "Could not create checkout session" }, 502, headers);

  try {
    await env.DB.prepare("INSERT INTO orders (id, stripe_session_id, status, currency, amount_total, customer_email) VALUES (?, ?, 'pending', 'gbp', ?, ?)")
      .bind(crypto.randomUUID(), session.id, totalPence, null).run();
  } catch {
    // Never send the checkout URL until its pending order is durably recorded.
    return json({ error: "Could not record the order. Please retry." }, 503, headers);
  }
  return json({ url: checkoutUrl.toString() }, 200, headers);
}
