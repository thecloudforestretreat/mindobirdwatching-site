const PUBLIC_ORIGIN = "https://mindobirdwatching.com";
const N8N_WEBHOOK = "https://n8n.mindobirdwatching.com/webhook/mbw-guide-tour-recap";
const TOUR_TYPES = new Set(["half_day", "full_day", "custom_private", "multi_day"]);
const OBSERVATION_TYPES = new Set(["seen", "heard", "seen_and_heard"]);

function headers(request) {
  const origin = request.headers.get("origin") || "";
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": origin === PUBLIC_ORIGIN ? origin : PUBLIC_ORIGIN, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" };
}
function json(request, body, status = 200) { return new Response(JSON.stringify(body), { status, headers: headers(request) }); }
function clean(value, length) { return String(value || "").trim().slice(0, length); }

async function verifyTurnstile(request, secret, token) {
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY is not configured.");
  if (!token) return false;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: request.headers.get("CF-Connecting-IP") || "" }),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => ({}));
  return result.success === true;
}

export async function onRequestPost({ request, env }) {
  let input;
  try { input = await request.json(); } catch { return json(request, { ok: false, message: "Invalid submission." }, 400); }

  try {
    if (!(await verifyTurnstile(request, env.TURNSTILE_SECRET_KEY, clean(input.turnstile_token, 2048)))) return json(request, { ok: false, message: "Security check failed. Please try again. / La verificación falló. Intenta otra vez." }, 403);
  } catch (error) {
    console.error("Contributor recap Turnstile failed", { message: error?.message });
    return json(request, { ok: false, message: "The security service is temporarily unavailable. / El servicio de seguridad no está disponible." }, 503);
  }

  const contributorNumber = clean(input.contributor_number, 12);
  const tourDate = clean(input.tour_date, 10);
  const routeName = clean(input.route_name, 160);
  const tourType = clean(input.tour_type, 30);
  if (!/^\d{3}$/.test(contributorNumber)) return json(request, { ok: false, message: "Enter your valid 3-digit contributor number. / Ingresa tu número válido de 3 dígitos." }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tourDate) || !routeName || !TOUR_TYPES.has(tourType)) return json(request, { ok: false, message: "Tour date, type, and route are required. / La fecha, el tipo y la ruta son obligatorios." }, 400);
  if (!Array.isArray(input.species) || !input.species.length || input.species.length > 300) return json(request, { ok: false, message: "Select between 1 and 300 birds. / Selecciona entre 1 y 300 aves." }, 400);

  const species = input.species.map((bird) => ({ speciesCode: clean(bird.speciesCode, 24), englishName: clean(bird.englishName, 120), spanishName: clean(bird.spanishName, 120), seen_or_heard: OBSERVATION_TYPES.has(bird.seen_or_heard) ? bird.seen_or_heard : "seen", quantity: Math.min(999, Math.max(1, Number(bird.quantity) || 1)) }));
  if (species.some((bird) => !/^[a-z0-9-]{2,24}$/i.test(bird.speciesCode))) return json(request, { ok: false, message: "The checklist contains an invalid species code." }, 400);

  const recapId = "recap_" + crypto.randomUUID();
  const payload = { action: "submit_contributor_recap", recap_id: recapId, submitted_at: new Date().toISOString(), contributor_number: contributorNumber, tour_date: tourDate, tour_type: tourType, route_name: routeName, booking_reference: clean(input.booking_reference, 80), general_notes: clean(input.general_notes, 3000), recap_status: "submitted", species };
  try {
    const response = await fetch(env.N8N_GUIDE_TOUR_RECAP_WEBHOOK_URL || N8N_WEBHOOK, { method: "POST", headers: { "content-type": "application/json", "x-mbw-recap-id": recapId }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    let result = {};
    try { result = JSON.parse(text || "{}"); } catch {}
    if (response.status === 401 || response.status === 403 || result.valid_contributor === false) return json(request, { ok: false, message: "Contributor number not recognized. / Número no reconocido." }, 403);
    if (!response.ok) throw new Error("Contributor recap workflow returned " + response.status + ": " + text.slice(0, 200));
    return json(request, { ok: true, recap_id: recapId });
  } catch (error) {
    console.error("Contributor recap submission failed", { recapId, message: error?.message });
    return json(request, { ok: false, message: "The report could not be saved. Please try again. / No se pudo guardar. Intenta otra vez.", recap_id: recapId }, 502);
  }
}

export async function onRequestGet({ request }) { return json(request, { ok: false, message: "Method Not Allowed" }, 405); }
export async function onRequestOptions({ request }) { const responseHeaders = headers(request); delete responseHeaders["content-type"]; return new Response(null, { status: 204, headers: responseHeaders }); }
