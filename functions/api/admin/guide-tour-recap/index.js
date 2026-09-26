const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";
const TOUR_TYPES = new Set(["half_day", "full_day", "custom_private", "multi_day"]);
const OBSERVATION_TYPES = new Set(["seen", "heard", "seen_and_heard"]);

function headers(request) {
  const origin = request.headers.get("origin") || "";
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": origin === ADMIN_ORIGIN ? origin : ADMIN_ORIGIN, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" };
}
function json(request, body, status = 200) { return new Response(JSON.stringify(body), { status, headers: headers(request) }); }
function clean(value, length) { return String(value || "").trim().slice(0, length); }

export async function onRequestPost({ request, env }) {
  const webhook = env.N8N_GUIDE_TOUR_RECAP_WEBHOOK_URL;
  if (!webhook) return json(request, { ok: false, message: "N8N_GUIDE_TOUR_RECAP_WEBHOOK_URL is not configured." }, 503);
  let input;
  try { input = await request.json(); } catch { return json(request, { ok: false, message: "Invalid JSON body." }, 400); }
  const tourDate = clean(input.tour_date, 10), guideName = clean(input.guide_name, 100), routeName = clean(input.route_name, 160), tourType = clean(input.tour_type, 30);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tourDate) || !guideName || !routeName || !TOUR_TYPES.has(tourType)) return json(request, { ok: false, message: "Tour date, tour type, guide name, and route are required." }, 400);
  if (!Array.isArray(input.species) || !input.species.length || input.species.length > 300) return json(request, { ok: false, message: "Select between 1 and 300 birds." }, 400);
  const species = input.species.map((bird) => ({ speciesCode: clean(bird.speciesCode, 24), englishName: clean(bird.englishName, 120), spanishName: clean(bird.spanishName, 120), seen_or_heard: OBSERVATION_TYPES.has(bird.seen_or_heard) ? bird.seen_or_heard : "seen", quantity: Math.min(999, Math.max(1, Number(bird.quantity) || 1)) }));
  if (species.some((bird) => !/^[a-z0-9-]{2,24}$/i.test(bird.speciesCode))) return json(request, { ok: false, message: "The checklist contains an invalid species code." }, 400);
  const recapId = "recap_" + crypto.randomUUID();
  const payload = { recap_id: recapId, submitted_at: new Date().toISOString(), tour_date: tourDate, tour_type: tourType, guide_name: guideName, route_name: routeName, general_notes: clean(input.general_notes, 3000), recap_status: "submitted", species };
  try {
    const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json", "x-mbw-recap-id": recapId }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    if (!response.ok) throw new Error("Guide recap workflow returned " + response.status + ": " + text.slice(0, 200));
    return json(request, { ok: true, recap_id: recapId });
  } catch (error) {
    console.error("Guide recap submission failed", { recapId, message: error?.message });
    return json(request, { ok: false, message: "The guide recap workflow is temporarily unavailable.", recap_id: recapId }, 502);
  }
}

export async function onRequestGet({ request }) { return json(request, { ok: false, message: "Method Not Allowed" }, 405); }
export async function onRequestOptions({ request }) { const h = headers(request); delete h["content-type"]; return new Response(null, { status: 204, headers: h }); }
