const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";
const VALID_SOURCES = new Set(["all", "ebird", "guide"]);
const DEFAULT_WEBHOOK = "https://n8n.mindobirdwatching.com/webhook/mbw-admin-bird-sightings";
const CACHE_FRESH_MS = 60 * 1000;
const CACHE_RETENTION_SECONDS = 6 * 60 * 60;
const pendingWorkflowRequests = new Map();

function headers(request) {
  const origin = request.headers.get("origin") || "";
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": origin === ADMIN_ORIGIN ? origin : ADMIN_ORIGIN, "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" };
}
function json(request, body, status = 200) { return new Response(JSON.stringify(body), { status, headers: headers(request) }); }
function clean(value, length = 100) { return String(value || "").trim().slice(0, length); }

async function fetchEbird(env, { speciesCode, days, limit }) {
  const apiKey = env.EBIRD_API_KEY || env.EBIRD_API_TOKEN;
  if (!apiKey) throw new Error("eBird API key is not configured in Cloudflare.");
  const path = speciesCode ? `/v2/data/obs/geo/recent/${encodeURIComponent(speciesCode)}` : "/v2/data/obs/geo/recent";
  const params = new URLSearchParams({ lat: env.TARGET_BIRD_LAT || "-0.051", lng: env.TARGET_BIRD_LNG || "-78.772", dist: env.TARGET_BIRD_DIST_KM || "20", back: String(Math.min(30, days)), maxResults: String(speciesCode ? 10000 : Math.max(limit, 50)), hotspot: "true", includeProvisional: "false" });
  const response = await fetch("https://api.ebird.org" + path + "?" + params, { headers: { "x-ebirdapitoken": apiKey }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("eBird returned " + response.status);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map((row) => ({ speciesCode: row.speciesCode, englishName: row.comName, scientificName: row.sciName, observed_at: row.obsDt, quantity: row.howMany || 1, location_name: row.locName, latitude: row.lat, longitude: row.lng, source: "ebird", ebird_sub_id: row.subId || "", ebird_obs_id: row.obsId || "", notable: row.notable === true, mbw_priority: "" }));
}

function uniqueReports(sightings) {
  const reports = new Map();
  sightings.forEach((row) => {
    const key = clean(row.ebird_sub_id, 80) || [row.speciesCode, row.observed_at, row.location_name].map((value) => clean(value, 160)).join("|");
    if (key && !reports.has(key)) reports.set(key, row);
  });
  return [...reports.values()];
}

function liveStats(speciesCode, sightings, limited = false) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;
  const thirtyDaysAgo = now - 30 * 86400000;
  const parsed = uniqueReports(sightings).map((row) => ({ row, time: Date.parse(String(row.observed_at || "").replace(" ", "T")) })).filter((item) => Number.isFinite(item.time)).sort((a, b) => b.time - a.time);
  return { speciesCode, available: parsed.length > 0, last_observed_at: parsed[0]?.row?.observed_at || "", last_7_days: parsed.filter((item) => item.time >= sevenDaysAgo).length, last_30_days: parsed.filter((item) => item.time >= thirtyDaysAgo).length, last_7_days_limited: Boolean(limited && parsed.at(-1)?.time >= sevenDaysAgo), last_30_days_limited: limited, refreshed_at: new Date().toISOString(), source: "ebird_live" };
}

function sightingsFrom(data) {
  return Array.isArray(data) ? data : Array.isArray(data?.sightings) ? data.sightings : Array.isArray(data?.data) ? data.data : [];
}

function cacheRequest(request, { speciesCode, source, days }) {
  const url = new URL(request.url);
  url.search = "";
  url.searchParams.set("speciesCode", speciesCode);
  url.searchParams.set("source", source);
  url.searchParams.set("days", String(days));
  return new Request(url.toString(), { method: "GET" });
}

async function readCachedSightings(request, params) {
  const cache = globalThis.caches?.default;
  if (!cache) return null;
  try {
    const response = await cache.match(cacheRequest(request, params));
    if (!response) return null;
    const entry = await response.json();
    if (!entry || !entry.storedAt || !entry.body) return null;
    return { ...entry, ageMs: Math.max(0, Date.now() - Date.parse(entry.storedAt)) };
  } catch (error) {
    console.error("Admin sightings cache read failed", { message: error?.message });
    return null;
  }
}

async function writeCachedSightings(request, params, body) {
  const cache = globalThis.caches?.default;
  if (!cache) return;
  const response = new Response(JSON.stringify({ storedAt: new Date().toISOString(), body }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `max-age=${CACHE_RETENTION_SECONDS}` },
  });
  await cache.put(cacheRequest(request, params), response).catch((error) => {
    console.error("Admin sightings cache write failed", { message: error?.message });
  });
}

function workflowRequestKey(webhook, payload) {
  return JSON.stringify([webhook, payload.speciesCode, payload.source, payload.days, payload.limit, Boolean(payload.liveStats), Boolean(payload.trackDemand)]);
}

async function fetchWorkflow(webhook, payload) {
  const key = workflowRequestKey(webhook, payload);
  if (pendingWorkflowRequests.has(key)) return pendingWorkflowRequests.get(key);
  const operation = (async () => {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error("Sightings workflow returned " + response.status + ": " + text.slice(0, 200));
    try { return JSON.parse(text || "{}"); }
    catch { throw new Error("Sightings workflow returned HTML instead of JSON."); }
  })();
  pendingWorkflowRequests.set(key, operation);
  try { return await operation; }
  finally { pendingWorkflowRequests.delete(key); }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const webhook = env.N8N_ADMIN_BIRD_SIGHTINGS_WEBHOOK_URL || DEFAULT_WEBHOOK;
  const input = new URL(request.url).searchParams;
  const speciesCode = clean(input.get("speciesCode"), 24);
  if (speciesCode && !/^[a-z0-9-]{2,24}$/i.test(speciesCode)) return json(request, { ok: false, message: "Invalid species code." }, 400);
  const source = VALID_SOURCES.has(input.get("source")) ? input.get("source") : "all";
  const days = Math.min(365, Math.max(1, Number(input.get("days")) || 30));
  const limit = Math.min(100, Math.max(1, Number(input.get("limit")) || 100));
  const requestLiveStats = input.get("liveStats") === "1" && Boolean(speciesCode);
  const trackDemand = input.get("trackDemand") === "1" && Boolean(speciesCode);
  const cacheParams = { speciesCode, source, days };
  const canUseCache = !requestLiveStats && !trackDemand;
  const cached = canUseCache ? await readCachedSightings(request, cacheParams) : null;
  if (cached && cached.ageMs <= CACHE_FRESH_MS) {
    const sightings = sightingsFrom(cached.body).slice(0, limit);
    return json(request, { ...cached.body, count: sightings.length, sightings, cache: "hit", cache_age_seconds: Math.round(cached.ageMs / 1000) });
  }
  const payload = { action: "list_sightings", speciesCode, source, days, limit, liveStats: requestLiveStats, trackDemand, requested_at: new Date().toISOString() };
  try {
    const data = await fetchWorkflow(webhook, payload);
    if (requestLiveStats) {
      let ebirdSightings = sightingsFrom(data).filter((row) => row && row.source === "ebird" && row.speciesCode === speciesCode);
      if (!ebirdSightings.length && (env.EBIRD_API_KEY || env.EBIRD_API_TOKEN)) ebirdSightings = await fetchEbird(env, { speciesCode, days: 30, limit });
      if (!ebirdSightings.length) return json(request, { ok: false, stats_available: false, message: "Live eBird data is unavailable. No zero totals were recorded." }, 503);
      const limited = ebirdSightings.length >= limit;
      return json(request, { ok: true, count: Math.min(ebirdSightings.length, limit), sightings: ebirdSightings.slice(0, limit), stats: liveStats(speciesCode, ebirdSightings, limited), demand_tracked: data.demand_tracked === true });
    }
    const sightings = sightingsFrom(data).slice(0, limit);
    const body = {
      ok: true,
      count: sightings.length,
      sightings,
      stats: data.stats || null,
      ebird_available: data.ebird_available !== false,
      degraded: Boolean(data.warning),
      warning: clean(data.warning, 240),
      cache: "miss",
    };
    if (canUseCache) await writeCachedSightings(request, cacheParams, body);
    return json(request, body);
  } catch (error) {
    console.error("Admin sightings workflow lookup failed", { message: error?.message });
    if (cached) {
      const sightings = sightingsFrom(cached.body).slice(0, limit);
      return json(request, {
        ...cached.body,
        ok: true,
        count: sightings.length,
        sightings,
        degraded: true,
        warning: "Live refresh is temporarily unavailable; cached sightings are shown.",
        cache: "stale",
        cache_age_seconds: Math.round(cached.ageMs / 1000),
      });
    }
    if (source !== "guide") {
      try {
        const sightings = await fetchEbird(env, { speciesCode, days, limit });
        if (sightings.length) {
          const body = {
            ok: true,
            count: sightings.slice(0, limit).length,
            sightings: sightings.slice(0, limit),
            stats: requestLiveStats ? liveStats(speciesCode, sightings, sightings.length >= limit) : null,
            demand_tracked: false,
            fallback: "ebird",
            degraded: source === "all",
            warning: source === "all" ? "Guide reports are temporarily unavailable; live eBird sightings are shown." : "",
            cache: "miss",
          };
          if (canUseCache) await writeCachedSightings(request, cacheParams, body);
          return json(request, body);
        }
      } catch (ebirdError) { console.error("Direct eBird fallback failed", { message: ebirdError?.message }); }
    }
    if (requestLiveStats) return json(request, { ok: false, stats_available: false, message: "Live eBird data is unavailable. No zero totals were recorded." }, 503);
    return json(request, {
      ok: false,
      count: 0,
      sightings: [],
      degraded: true,
      message: "The sightings service is temporarily unavailable. Existing records are safe; please try Refresh shortly.",
    }, 503);
  }
}

export async function onRequestOptions({ request }) { const h = headers(request); delete h["content-type"]; return new Response(null, { status: 204, headers: h }); }
