const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";
const VALID_SOURCES = new Set(["all", "ebird", "guide"]);

function headers(request) {
  const origin = request.headers.get("origin") || "";
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": origin === ADMIN_ORIGIN ? origin : ADMIN_ORIGIN, "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" };
}
function json(request, body, status = 200) { return new Response(JSON.stringify(body), { status, headers: headers(request) }); }
function clean(value, length = 100) { return String(value || "").trim().slice(0, length); }

export async function onRequestGet({ request, env }) {
  const webhook = env.N8N_ADMIN_BIRD_SIGHTINGS_WEBHOOK_URL;
  if (!webhook) return json(request, { ok: false, message: "N8N_ADMIN_BIRD_SIGHTINGS_WEBHOOK_URL is not configured." }, 503);
  const input = new URL(request.url).searchParams;
  const speciesCode = clean(input.get("speciesCode"), 24);
  if (speciesCode && !/^[a-z0-9-]{2,24}$/i.test(speciesCode)) return json(request, { ok: false, message: "Invalid species code." }, 400);
  const source = VALID_SOURCES.has(input.get("source")) ? input.get("source") : "all";
  const days = Math.min(365, Math.max(1, Number(input.get("days")) || 30));
  const limit = Math.min(10, Math.max(1, Number(input.get("limit")) || 10));
  try {
    const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "list_sightings", speciesCode, source, days, limit }), signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    if (!response.ok) throw new Error("Sightings workflow returned " + response.status + ": " + text.slice(0, 200));
    const data = JSON.parse(text || "{}");
    const sightings = Array.isArray(data) ? data : Array.isArray(data.sightings) ? data.sightings : Array.isArray(data.data) ? data.data : [];
    return json(request, { ok: true, count: sightings.slice(0, limit).length, sightings: sightings.slice(0, limit) });
  } catch (error) {
    console.error("Admin sightings lookup failed", { message: error?.message });
    return json(request, { ok: false, message: "The sightings workflow is temporarily unavailable." }, 502);
  }
}

export async function onRequestOptions({ request }) { const h = headers(request); delete h["content-type"]; return new Response(null, { status: 204, headers: h }); }
