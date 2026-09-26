const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";
const DEFAULT_WEBHOOK = "https://n8n.mindobirdwatching.com/webhook/mbw-recommendation-guest-estimates";

function responseHeaders(request) {
  const origin = request.headers.get("origin") || "";
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": origin === ADMIN_ORIGIN ? origin : ADMIN_ORIGIN,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request) });
}

function clean(value, length = 120) {
  return String(value == null ? "" : value).trim().slice(0, length);
}

function integer(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function sanitizeEstimate(row) {
  return {
    partner_id: clean(row.partner_id, 80),
    estimated_guest_count: integer(row.estimated_guest_count),
    estimated_stay_count: integer(row.estimated_stay_count),
    matched_tour_records: integer(row.matched_tour_records),
    last_guest_date: /^\d{4}-\d{2}-\d{2}$/.test(clean(row.last_guest_date, 10)) ? clean(row.last_guest_date, 10) : "",
  };
}

export async function onRequestGet({ request, env }) {
  const webhook = env.N8N_RECOMMENDATION_GUEST_ESTIMATES_WEBHOOK_URL || DEFAULT_WEBHOOK;

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "recommendation_guest_estimates" }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error("Recommendation estimate workflow returned " + response.status + ": " + text.slice(0, 180));

    const payload = JSON.parse(text || "{}");
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload.estimates) ? payload.estimates : [];
    const estimates = rows.map(sanitizeEstimate).filter((row) => row.partner_id);

    return json(request, {
      ok: true,
      estimates,
      generated_at: clean(payload.generated_at, 40),
      source_last_tour_date: /^\d{4}-\d{2}-\d{2}$/.test(clean(payload.source_last_tour_date, 10)) ? clean(payload.source_last_tour_date, 10) : "",
      methodology: "Completed tours; pickup-location alias match; same guest and property within 14 days counted as one estimated stay.",
    });
  } catch (error) {
    console.error("Recommendation guest estimate lookup failed", { message: error?.message });
    return json(request, {
      ok: false,
      estimates: [],
      setup_required: true,
      message: "Invoice estimates are temporarily unavailable. Activate the MBW Recommendation Guest Estimates workflow.",
    }, 503);
  }
}

export async function onRequestOptions({ request }) {
  const headers = responseHeaders(request);
  delete headers["content-type"];
  return new Response(null, { status: 204, headers });
}
