export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Parse form body
    const formData = await request.formData();

    const turnstileToken = formData.get("cf_turnstile_response");
    const cfSecret = formData.get("cf_secret");

    // 1) Validate shared secret (Apps Script gate)
    if (!cfSecret || cfSecret !== env.CF_SHARED_SECRET) {
      return new Response(
        JSON.stringify({ ok: false, message: "Invalid source" }),
        { status: 401 }
      );
    }

    // 2) Validate Turnstile token exists
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ ok: false, message: "Missing security token" }),
        { status: 400 }
      );
    }

    // 3) Verify Turnstile with Cloudflare
    const verifyRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
          remoteip: request.headers.get("CF-Connecting-IP") || ""
        })
      }
    );

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      return new Response(
        JSON.stringify({ ok: false, message: "Security check failed" }),
        { status: 403 }
      );
    }

    // 4) Forward request to Apps Script
    const forwardBody = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      forwardBody.append(key, value);
    }

    // Inject secret for Apps Script
    forwardBody.set("cf_secret", env.CF_SHARED_SECRET);

    const gasRes = await fetch(env.GAS_BOOK_TOUR_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: forwardBody
    });

    const gasText = await gasRes.text();

    if (!gasRes.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Upstream error",
          status: gasRes.status
        }),
        { status: 405 }
      );
    }

    // 5) Success back to browser
    return new Response(gasText, {
      headers: {
        "content-type": "application/json"
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: "Server error" }),
      { status: 500 }
    );
  }
}
