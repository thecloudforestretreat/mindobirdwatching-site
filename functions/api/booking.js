export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY || "";
    const TCFR_BOOKING_WEBAPP_URL = env.TCFR_BOOKING_WEBAPP_URL || "";
    const TCFR_CF_GATE_SECRET = env.TCFR_CF_GATE_SECRET || "";

    if (!TURNSTILE_SECRET_KEY || !TCFR_BOOKING_WEBAPP_URL || !TCFR_CF_GATE_SECRET) {
      return json({ ok: false, message: "Server misconfigured: missing env vars." }, 500);
    }

    const ct = request.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) {
      data = await request.json();
    } else {
      const form = await request.formData();
      data = Object.fromEntries(form.entries());
    }

    const token = (data["cf-turnstile-response"] || data["turnstile"] || "").toString();
    if (!token) return json({ ok: false, message: "Missing Turnstile token." }, 400);

    const ip = request.headers.get("CF-Connecting-IP") || "";
    const ua = request.headers.get("User-Agent") || "";
    const source_page = (data.source_page || data.sourcePage || "").toString();

    const verifyOk = await verifyTurnstile(TURNSTILE_SECRET_KEY, token, ip);
    if (!verifyOk) return json({ ok: false, message: "Turnstile verification failed." }, 403);

    // Forward to Apps Script (server-side inject cf_secret)
    const body = new URLSearchParams();

    body.set("cf_secret", TCFR_CF_GATE_SECRET);

    // Normalize and forward fields for your Booking app script
    body.set("first_name", (data.first_name || "").toString());
    body.set("last_name", (data.last_name || "").toString());
    body.set("email", (data.email || "").toString());
    body.set("phone_number", (data.phone_number || data.phone || "").toString());

    body.set("number_of_days_interested", (data.number_of_days_interested || "").toString());
    body.set("number_of_guests", (data.number_of_guests || "").toString());
    body.set("room_preference", (data.room_preference || "").toString());
    body.set("transportation_needed", (data.transportation_needed || "").toString());
    body.set("how_did_you_hear_about_us", (data.how_did_you_hear_about_us || "").toString());

    // Use message_questions as your standardized field name going forward
    body.set("message_questions", (data.message_questions || data.message || "").toString());

    body.set("source_page", source_page);
    body.set("user_agent", ua);
    body.set("ip_best_effort", ip);

    // Optional: pass language hint if you want based on URL
    // body.set("lang", (data.lang || "").toString());

    const resp = await fetch(TCFR_BOOKING_WEBAPP_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    });

    // Apps Script usually returns 200 with text. We do not depend on it.
    const text = await resp.text();

    if (!resp.ok) {
      return json({ ok: false, message: "Upstream error", upstream_status: resp.status, upstream_body: text.slice(0, 300) }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, message: "Server error." }, 500);
  }
}

async function verifyTurnstile(secret, responseToken, ip) {
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", responseToken);
  if (ip) form.set("remoteip", ip);

  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: form
  });

  const j = await r.json();
  return !!j.success;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
