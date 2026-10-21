import { guideIdentity } from "../../lib/mobile-auth.mjs";
import { errorResponse, json, methodNotAllowed } from "../../lib/mobile-http.mjs";

const DEFAULT_WEBHOOK = "https://n8n.mindobirdwatching.com/webhook/mbw-admin-bird-sightings";
const CACHE_MS = 5 * 60 * 1000;
let cache = { expiresAt: 0, rows: [] };
let pending;

const clean = (value, length = 160) => String(value || "").trim().slice(0, length);

function rowsFrom(value) {
  return Array.isArray(value) ? value : Array.isArray(value?.sightings) ? value.sightings : Array.isArray(value?.data) ? value.data : [];
}

async function loadGuideSightings(env) {
  if (cache.expiresAt > Date.now()) return cache.rows;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(env.N8N_ADMIN_BIRD_SIGHTINGS_WEBHOOK_URL || DEFAULT_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "list_sightings", source: "guide", days: 365, limit: 100, requested_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Sightings workflow returned ${response.status}: ${text.slice(0, 160)}`);
    let data;
    try { data = JSON.parse(text || "{}"); } catch { throw new Error("Sightings workflow returned an invalid response."); }
    const rows = rowsFrom(data).filter(row => row && row.source === "guide" && row.recap_id);
    cache = { rows, expiresAt: Date.now() + CACHE_MS };
    return rows;
  })();
  try { return await pending; } finally { pending = null; }
}

function groupReports(rows) {
  const reports = new Map();
  for (const row of rows) {
    const recapId = clean(row.recap_id, 128);
    if (!recapId) continue;
    const current = reports.get(recapId) || {
      recapId,
      observedAt: clean(row.observed_at, 40),
      location: clean(row.location_name, 180),
      bookingReference: clean(row.tour_id, 128),
      speciesCount: 0,
      totalObservations: 0,
    };
    current.speciesCount += 1;
    current.totalObservations += Math.max(1, Number(row.quantity) || 1);
    reports.set(recapId, current);
  }
  return [...reports.values()].sort((a, b) => `${b.observedAt}|${b.recapId}`.localeCompare(`${a.observedAt}|${a.recapId}`));
}

export async function onRequestGet({ request, env }) {
  try {
    const identity = await guideIdentity(request, env);
    const rows = await loadGuideSightings(env);
    if (identity.role === "guide" && !identity.contributorNumber) {
      return json(200, { ok: true, reports: [], linked: false, checkedAt: new Date().toISOString() });
    }
    const allowed = identity.role === "guide"
      ? rows.filter(row => clean(row.guide_id, 80) === `contributor_${identity.contributorNumber}`)
      : rows;
    return json(200, { ok: true, reports: groupReports(allowed).slice(0, 30), linked: true, checkedAt: new Date().toISOString() });
  } catch (error) { return errorResponse(error, "Previous sighting reports are unavailable."); }
}

export function onRequestPost() { return methodNotAllowed(["GET"]); }
