const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";
const VALID_SOURCES = new Set(["all", "ebird", "guide"]);
const DEFAULT_WEBHOOK = "https://n8n.mindobirdwatching.com/webhook/mbw-admin-bird-sightings";

function headers(request) {
  const origin = request.headers.get("origin") || "";
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": origin === ADMIN_ORIGIN ? origin : ADMIN_ORIGIN, "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" };
}
function json(request, body, status = 200) { return new Response(JSON.stringify(body), { status, headers: headers(request) }); }
function clean(value, length = 100) { return String(value || "").trim().slice(0, length); }

async function fetchEbird(env, { speciesCode, days, limit }) {
  const apiKey = env.EBIRD_API_KEY || env.EBIRD_API_TOKEN;
  if (!apiKey) return [];
  const path = speciesCode ? `/v2/data/obs/geo/recent/${encodeURIComponent(speciesCode)}` : "/v2/data/obs/geo/recent";
  const params = new URLSearchParams({ lat: env.TARGET_BIRD_LAT || "-0.051", lng: env.TARGET_BIRD_LNG || "-78.772", dist: env.TARGET_BIRD_DIST_KM || "20", back: String(Math.min(30, days)), maxResults: String(Math.max(limit, 50)), hotspot: "true", includeProvisional: "false" });
  const response = await fetch("https://api.ebird.org" + path + "?" + params, { headers: { "x-ebirdapitoken": apiKey }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("eBird returned " + response.status);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map((row) => ({ speciesCode: row.speciesCode, englishName: row.comName, scientificName: row.sciName, observed_at: row.obsDt, quantity: row.howMany || 1, location_name: row.locName, latitude: row.lat, longitude: row.lng, source: "ebird", ebird_sub_id: row.subId || "", ebird_obs_id: row.obsId || "" })).slice(0, limit);
}

export async function onRequestGet({ request, env }) {
  const webhook = env.N8N_ADMIN_BIRD_SIGHTINGS_WEBHOOK_URL || DEFAULT_WEBHOOK;
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
    console.error("Admin sightings workflow lookup failed", { message: error?.message });
    if (source !== "guide") {
      try {
        const sightings = await fetchEbird(env, { speciesCode, days, limit });
        if (sightings.length) return json(request, { ok: true, count: sightings.length, sightings, fallback: "ebird" });
      } catch (ebirdError) { console.error("Direct eBird fallback failed", { message: ebirdError?.message }); }
    }
    return json(request, { ok: true, count: 0, sightings: [], setup_required: true, message: "No sightings have been synced yet. Activate the MBW Birding Data workflow to load eBird and guide reports." });
  }
}

export async function onRequestOptions({ request }) { const h = headers(request); delete h["content-type"]; return new Response(null, { status: 204, headers: h }); }
