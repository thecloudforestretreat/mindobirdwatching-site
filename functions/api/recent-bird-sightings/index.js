export async function onRequestPost(context) {
  const { request, env } = context;
  const json = (body, init = {}) => new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...(init.headers || {})
    }
  });

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const token = body.turnstileToken || body["cf-turnstile-response"] || "";
  if (env.TURNSTILE_SECRET_KEY) {
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || ""
      })
    });
    const result = await verify.json().catch(() => ({}));
    if (!result.success) {
      return json({ ok: false, message: "Turnstile verification failed." }, { status: 403 });
    }
  }

  const webhook = env.N8N_RECENT_SIGHTINGS_WEBHOOK_URL;
  if (!webhook) {
    return json({ ok: false, message: "N8N_RECENT_SIGHTINGS_WEBHOOK_URL is not configured." }, { status: 500 });
  }

  const payload = {
    ...body,
    request_type: "recent_bird_sightings_mindo",
    request_status: "submitted",
    page_path: body.source_page || "",
    turnstileToken: undefined,
    "cf-turnstile-response": undefined
  };

  const forward = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await forward.text();
  if (!forward.ok) {
    return json({ ok: false, message: "Recent sightings workflow returned " + forward.status, detail: text.slice(0, 400) }, { status: 502 });
  }

  let data = {};
  try { data = JSON.parse(text); } catch (error) { data = { raw: text.slice(0, 400) }; }
  return json({ ok: true, request_id: payload.request_id, workflow: data });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}
