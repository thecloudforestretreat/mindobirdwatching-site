const MAX_SPECIES = 100;
const WEBHOOK_TIMEOUT_MS = 12_000;

function messageResponse(request, status, message, extra = {}, httpStatus = 200) {
  const payload = JSON.stringify({ type: "mbw-target-bird", status, message, ...extra })
    .replace(/</g, "\\u003c");
  const origin = new URL(request.url).origin;

  return new Response(
    `<!doctype html><meta charset="utf-8"><script>parent.postMessage(${payload},${JSON.stringify(origin)});</script>`,
    {
      status: httpStatus,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'self'`,
        "x-content-type-options": "nosniff",
      },
    },
  );
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function uniqueSpeciesCodes(value) {
  return [...new Set(String(value || "").split(",").map((code) => code.trim()).filter(Boolean))];
}

function validSpeciesCode(code) {
  return /^[a-z0-9-]{2,24}$/i.test(code);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = `web_${crypto.randomUUID()}`;

  try {
    const formData = await request.formData();
    const turnstileSecret = env.TURNSTILE_SECRET_KEY || env.CF_TURNSTILE_SECRET;
    const turnstileToken = clean(formData.get("cf-turnstile-response"), 4096);
    const forwardUrl =
      env.N8N_TARGET_BIRD_WEBHOOK_URL ||
      env.TARGET_BIRD_WEBHOOK_URL ||
      env.GAS_TARGET_BIRD_TOUR_BUILDER_URL;

    if (!forwardUrl || !turnstileSecret) {
      console.error("Target bird endpoint configuration is incomplete", { requestId });
      return messageResponse(request, "error", "The request service is temporarily unavailable.", { request_id: requestId }, 503);
    }

    const verifyBody = new URLSearchParams({ secret: turnstileSecret, response: turnstileToken });
    verifyBody.set("remoteip", request.headers.get("CF-Connecting-IP") || "");
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verifyBody,
    });
    const verification = await verifyResponse.json().catch(() => ({}));
    if (!verifyResponse.ok || !verification.success) {
      console.warn("Turnstile rejected target bird request", {
        requestId,
        codes: verification["error-codes"] || [],
      });
      return messageResponse(request, "error", "Verification expired or failed. Please verify again.", { request_id: requestId }, 400);
    }

    const speciesCodes = uniqueSpeciesCodes(formData.get("selected_species_codes"));
    if (!speciesCodes.length) {
      return messageResponse(request, "error", "Please select at least one target bird.", { request_id: requestId }, 400);
    }
    if (speciesCodes.length > MAX_SPECIES) {
      return messageResponse(request, "error", `Please select no more than ${MAX_SPECIES} target birds.`, { request_id: requestId }, 400);
    }
    if (speciesCodes.some((code) => !validSpeciesCode(code))) {
      return messageResponse(request, "error", "The selected bird list contains an invalid species code.", { request_id: requestId }, 400);
    }

    const firstName = clean(formData.get("first_name"), 80);
    const lastName = clean(formData.get("last_name"), 80);
    const email = clean(formData.get("visitor_email"), 254);
    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return messageResponse(request, "error", "Please provide your name and a valid email address.", { request_id: requestId }, 400);
    }

    const now = new Date().toISOString();
    const payload = {
      request_id: requestId,
      report_id: `report_${requestId}`,
      submitted_at: now,
      request_status: "website_submitted",
      visitor_name: `${firstName} ${lastName}`,
      first_name: firstName,
      last_name: lastName,
      visitor_email: email,
      visitor_whatsapp: clean(formData.get("visitor_whatsapp"), 40),
      preferred_contact_method: clean(formData.get("preferred_contact_method"), 20) || "email",
      preferred_language: clean(formData.get("preferred_language"), 5) === "es" ? "es" : "en",
      requested_dates: clean(formData.get("requested_dates"), 100),
      start_date: clean(formData.get("start_date"), 10),
      birding_days: clean(formData.get("birding_days"), 4),
      group_size: clean(formData.get("group_size"), 4),
      fitness_level: clean(formData.get("fitness_level"), 20),
      photography_priority: clean(formData.get("photography_priority"), 20),
      target_notes: clean(formData.get("target_notes"), 4000),
      selected_species_names: clean(formData.get("selected_species_names"), 8000),
      source_page: clean(formData.get("source_page"), 2048),
      user_agent: clean(formData.get("user_agent") || request.headers.get("user-agent"), 500),
      speciesCodes,
      telegram_chat_id: env.TARGET_BIRD_TELEGRAM_CHAT_ID || "",
      config: {
        lat: Number(env.TARGET_BIRD_LAT || "-0.051"),
        lng: Number(env.TARGET_BIRD_LNG || "-78.772"),
        distKm: Number(env.TARGET_BIRD_DIST_KM || "20"),
        backDays: Number(env.TARGET_BIRD_BACK_DAYS || "14"),
        maxResults: Number(env.TARGET_BIRD_MAX_RESULTS || "50"),
      },
    };

    const response = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mbw-request-id": requestId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    const responseText = await response.text();
    if (!response.ok) {
      console.error("Target bird workflow rejected request", {
        requestId,
        status: response.status,
        response: responseText.slice(0, 1000),
        speciesCount: speciesCodes.length,
      });
      return messageResponse(request, "error", "We could not receive your request. Please try again or use WhatsApp.", { request_id: requestId }, 502);
    }

    console.log("Target bird request accepted", { requestId, speciesCount: speciesCodes.length });
    return messageResponse(request, "ok", "Your target bird request was received.", {
      request_id: requestId,
      report_id: payload.report_id,
    });
  } catch (error) {
    console.error("Unexpected target bird submission error", {
      requestId,
      name: error?.name,
      message: error?.message,
    });
    const timedOut = error?.name === "TimeoutError";
    return messageResponse(
      request,
      "error",
      timedOut ? "The request service took too long. Please try again or use WhatsApp." : "Unexpected error sending your request.",
      { request_id: requestId },
      timedOut ? 504 : 500,
    );
  }
}

export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
}
