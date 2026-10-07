const ALLOWED_ORIGIN = "https://leonmarchandise.co.uk";

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin");
  if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400", Vary: "Origin" } });
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get("Origin");
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=300", "X-Content-Type-Options": "nosniff", Vary: "Origin" };
  if (origin && origin !== ALLOWED_ORIGIN) return Response.json({ error: "Origin not allowed" }, { status: 403, headers: { ...headers, "Cache-Control": "no-store" } });
  if (origin === ALLOWED_ORIGIN) headers["Access-Control-Allow-Origin"] = origin;
  if (!env.DB) return Response.json({ error: "Catalogue is not configured" }, { status: 503, headers: { ...headers, "Cache-Control": "no-store" } });

  const url = new URL(request.url);
  const language = url.searchParams.get("lang") === "fr" ? "fr" : "en";
  const category = url.searchParams.get("category");
  const query = url.searchParams.get("q")?.trim().slice(0, 80);
  let sql = language === "fr"
    ? "SELECT id, COALESCE(name_fr, name) AS name, COALESCE(description_fr, description) AS description, price_pence, category, image_url FROM products WHERE active = 1"
    : "SELECT id, name, description, price_pence, category, image_url FROM products WHERE active = 1";
  const bindings = [];
  if (category && /^[a-z0-9-]{1,50}$/.test(category)) { sql += " AND category = ?"; bindings.push(category); }
  if (query) { sql += language === "fr"
    ? " AND (COALESCE(name_fr, name) LIKE ? OR COALESCE(description_fr, description) LIKE ?)"
    : " AND (name LIKE ? OR description LIKE ?)";
    bindings.push(`%${query}%`, `%${query}%`);
  }
  sql += " ORDER BY sort_order ASC, id ASC LIMIT 100";
  let result;
  try {
    result = await env.DB.prepare(sql).bind(...bindings).all();
  } catch {
    // Fallback supports an installation where migration 0002 has not yet been applied.
    sql = "SELECT id, name, description, price_pence, category, image_url FROM products WHERE active = 1";
    const fallbackBindings = [];
    if (category && /^[a-z0-9-]{1,50}$/.test(category)) { sql += " AND category = ?"; fallbackBindings.push(category); }
    if (query) { sql += " AND (name LIKE ? OR description LIKE ?)"; fallbackBindings.push(`%${query}%`, `%${query}%`); }
    sql += " ORDER BY sort_order ASC, id ASC LIMIT 100";
    result = await env.DB.prepare(sql).bind(...fallbackBindings).all();
  }
  const products = (result.results || []).map((row) => ({ id: row.id, name: row.name, description: row.description, pricePence: row.price_pence, category: row.category, imageUrl: row.image_url }));
  return Response.json({ products }, { headers });
}
