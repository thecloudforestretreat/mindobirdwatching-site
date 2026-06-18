export async function onRequestPost(context) {
  const { request, env } = context;

  function htmlMessage(status, message, extra = {}) {
    const payload = JSON.stringify({
      type: "mbw-target-bird",
      status,
      message,
      ...extra
    });

    return new Response(`<!doctype html><meta charset="utf-8"><script>parent.postMessage(${payload},"*");</script>`, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  try {
    const formData = await request.formData();
    const turnstileToken = String(formData.get("cf-turnstile-response") || "");
    const turnstileSecret = env.TURNSTILE_SECRET_KEY || env.CF_TURNSTILE_SECRET || "";
    const forwardUrl =
      env.N8N_TARGET_BIRD_WEBHOOK_URL ||
      env.TARGET_BIRD_WEBHOOK_URL ||
      env.GAS_TARGET_BIRD_TOUR_BUILDER_URL ||
      "";

    if (!forwardUrl) {
      return htmlMessage("error", "Target bird endpoint is not configured.");
    }

    if (turnstileSecret) {
      const verifyBody = new URLSearchParams();
      verifyBody.set("secret", turnstileSecret);
      verifyBody.set("response", turnstileToken);
      verifyBody.set("remoteip", request.headers.get("CF-Connecting-IP") || "");

      const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: verifyBody
      });
      const verifyJson = await verifyResponse.json().catch(() => ({}));

      if (!verifyJson.success) {
        return htmlMessage("error", "Turnstile verification failed. Please try again.");
      }
    }

    const selectedSpeciesCodes = String(formData.get("selected_species_codes") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!selectedSpeciesCodes.length) {
      return htmlMessage("error", "Please select at least one target bird.");
    }

    const now = new Date().toISOString();
    const firstName = String(formData.get("first_name") || "").trim();
    const lastName = String(formData.get("last_name") || "").trim();
    const visitorName = [firstName, lastName].filter(Boolean).join(" ");

    const payload = {
      request_id: `web_${Date.now()}`,
      report_id: `report_web_${Date.now()}`,
      submitted_at: now,
      request_status: "website_submitted",
      visitor_name: visitorName,
      first_name: firstName,
      last_name: lastName,
      visitor_email: String(formData.get("visitor_email") || "").trim(),
      visitor_whatsapp: String(formData.get("visitor_whatsapp") || "").trim(),
      preferred_contact_method: String(formData.get("preferred_contact_method") || "email"),
      preferred_language: String(formData.get("preferred_language") || "en"),
      requested_dates: String(formData.get("requested_dates") || "").trim(),
      start_date: String(formData.get("start_date") || "").trim(),
      birding_days: String(formData.get("birding_days") || "").trim(),
      group_size: String(formData.get("group_size") || "").trim(),
      fitness_level: String(formData.get("fitness_level") || "").trim(),
      photography_priority: String(formData.get("photography_priority") || "").trim(),
      target_notes: String(formData.get("target_notes") || "").trim(),
      selected_species_names: String(formData.get("selected_species_names") || "").trim(),
      source_page: String(formData.get("source_page") || "").trim(),
      user_agent: String(formData.get("user_agent") || request.headers.get("user-agent") || "").slice(0, 500),
      speciesCodes: selectedSpeciesCodes,
      telegram_chat_id: env.TARGET_BIRD_TELEGRAM_CHAT_ID || "-1004400311019",
      config: {
        lat: Number(env.TARGET_BIRD_LAT || "-0.051"),
        lng: Number(env.TARGET_BIRD_LNG || "-78.772"),
        distKm: Number(env.TARGET_BIRD_DIST_KM || "20"),
        backDays: Number(env.TARGET_BIRD_BACK_DAYS || "14"),
        maxResults: Number(env.TARGET_BIRD_MAX_RESULTS || "50")
      }
    };

    const forwardResponse = await fetch(forwardUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!forwardResponse.ok) {
      return htmlMessage("error", `Report workflow returned ${forwardResponse.status}.`);
    }

    return htmlMessage("ok", "Target bird request sent.", {
      request_id: payload.request_id,
      report_id: payload.report_id
    });
  } catch (error) {
    return htmlMessage("error", "Unexpected error sending target bird request.");
  }
}

export async function onRequestGet() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { allow: "POST" }
  });
}
