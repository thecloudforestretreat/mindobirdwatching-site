const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": ADMIN_ORIGIN,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "vary": "Origin",
};

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function clean(value, maxLength = 255) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result ? result.slice(0, maxLength) : null;
}

function validId(value) {
  const result = clean(value, 128);
  return result && /^[A-Za-z0-9_.-]{1,128}$/.test(result) ? result : null;
}

export async function onRequestPost({ request, env }) {
  try {
    const origin = request.headers.get("origin") || "";
    if (origin !== ADMIN_ORIGIN) {
      return reply(403, { ok: false, error: "origin_not_allowed" });
    }

    const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
      return reply(403, { ok: false, error: "cross_site_request_rejected" });
    }

    if (!env.CF_SHARED_SECRET) {
      return reply(503, { ok: false, error: "shared_secret_unavailable" });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return reply(415, { ok: false, error: "application_json_required" });
    }

    if (Number(request.headers.get("content-length") || 0) > 16384) {
      return reply(413, { ok: false, error: "payload_too_large" });
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return reply(400, { ok: false, error: "invalid_json" });
    }

    const payload = {
      inquiry_id: validId(input.inquiry_id),
      guest_id: validId(input.guest_id),
      booking_id: validId(input.booking_id),
      quote_id: validId(input.quote_id),
      invoice_id: validId(input.invoice_id),
      payment_method: "zelle",
      booking_status: clean(input.booking_status || input.status, 32),
      payment_status: clean(input.payment_status, 32),
      amount_received: Number(input.amount_received || input.amount_paid || 0),
      currency: clean(input.currency, 3) || "USD",
      email: clean(input.email, 320),
      phone_number: clean(input.phone_number || input.phone, 64),
      product_selected: clean(input.product_selected || input.tour_type, 255),
      meta_fbp: clean(input.meta_fbp || input.fbp, 255),
      meta_fbc: clean(input.meta_fbc || input.fbc, 255),
    };

    if (!payload.inquiry_id) {
      return reply(400, { ok: false, error: "valid_inquiry_id_required" });
    }
    if (!payload.invoice_id) {
      return reply(400, { ok: false, error: "valid_invoice_id_required" });
    }

    const upstream = await fetch("https://mindobirdwatching.com/api/attribution/link", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.CF_SHARED_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    let result;
    try {
      result = await upstream.json();
    } catch {
      result = { ok: false, error: "invalid_upstream_response" };
    }

    return reply(upstream.status, result);
  } catch (error) {
    console.error("Zelle attribution proxy failed", error);
    return reply(500, { ok: false, error: "zelle_attribution_proxy_failed" });
  }
}

export async function onRequestGet() {
  return reply(405, { ok: false, error: "method_not_allowed" });
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("origin") || "";
  if (origin !== ADMIN_ORIGIN) {
    return reply(403, { ok: false, error: "origin_not_allowed" });
  }
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}
