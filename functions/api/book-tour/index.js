// functions/api/book-tour/index.js
// MBW Book Tour proxy: Turnstile verify -> forward to Google Apps Script web app
// Required CF Pages env vars (Production):
// - TURNSTILE_SECRET_KEY
// - GAS_BOOK_TOUR_URL
// - CF_SHARED_SECRET

export async function onRequestPost({ request, env }) {
  const gasUrl = env.GAS_WEB_APP_URL;
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  const sharedSecret = env.CF_SHARED_SECRET;

  function iframeReply(status, message) {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
(function(){
  try{
    parent.postMessage({ type:"mbw-booktour", status:${JSON.stringify(
      status
    )}, message:${JSON.stringify(message || "")} }, "*");
  }catch(e){}
})();
</script>
</body></html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  try {
    if (!gasUrl) return iframeReply("error", "Server misconfigured. Missing GAS_WEB_APP_URL.");
    if (!turnstileSecret) return iframeReply("error", "Server misconfigured. Missing TURNSTILE_SECRET_KEY.");
    if (!sharedSecret) return iframeReply("error", "Server misconfigured. Missing CF_SHARED_SECRET.");

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return iframeReply("error", "Invalid request.");
    }

    const formData = await request.formData();

    // Honeypot
    if ((formData.get("website") || "").toString().trim() !== "") {
      // Silently accept (bot)
      return iframeReply("ok", "");
    }

    // Turnstile token from the browser
    const token = formData.get("cf-turnstile-response");
    if (!token) {
      return iframeReply("error", "Security check failed. Try again. (missing token)");
    }

    // Verify Turnstile
    let verify;
    try {
      const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: token.toString(),
          remoteip: request.headers.get("CF-Connecting-IP") || ""
        })
      });
      verify = await resp.json();
    } catch (e) {
      return iframeReply("error", "Security service unavailable.");
    }

    if (!verify || !verify.success) {
      const code = (verify && verify["error-codes"] && verify["error-codes"][0]) ? verify["error-codes"][0] : "invalid";
      return iframeReply("error", `Security check failed. Try again. (${code})`);
    }

    // Build payload for Apps Script (must include cf_secret)
    const body = new URLSearchParams();
    for (const [k, v] of formData.entries()) {
      if (k === "cf-turnstile-response") continue;
      if (k === "website") continue;
      body.append(k, v.toString());
    }
    // This is what your Apps Script checks:
    body.append("cf_secret", sharedSecret);

    // Google Apps Script often returns 302 to a googleusercontent URL.
    // For 302/303 we must follow with GET (no body) to avoid 405.
    async function fetchAppsScriptWithRedirects(url) {
      let current = url;

      for (let i = 0; i < 3; i++) {
        const res = await fetch(current, {
          method: "POST",
          redirect: "manual",
          headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: body.toString()
        });

        // If we got a normal OK response, return it
        if (res.status >= 200 && res.status < 300) return res;

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get("location");
          if (!loc) return res;

          // For 301/302/303: follow with GET (no body) to avoid 405 at googleusercontent
          if ([301, 302, 303].includes(res.status)) {
            const follow = await fetch(loc, { method: "GET", redirect: "follow" });
            return follow;
          }

          // For 307/308: safe to repeat POST to new location
          current = loc;
          continue;
        }

        return res;
      }

      return new Response("Too many redirects", { status: 508 });
    }

    let upstream;
    try {
      upstream = await fetchAppsScriptWithRedirects(gasUrl);
    } catch (e) {
      return iframeReply("error", "Booking service unreachable.");
    }

    if (!upstream.ok) {
      return iframeReply("error", `Booking failed. Upstream status=${upstream.status}.`);
    }

    let payload;
    try {
      payload = await upstream.json();
    } catch (e) {
      return iframeReply("error", "Invalid server response.");
    }

    if (!payload || !payload.ok) {
      return iframeReply("error", (payload && payload.message) ? payload.message : "Booking failed.");
    }

    return iframeReply("ok", "");
  } catch (e) {
    return iframeReply("error", "Server error. Please try again, or email us at mindobirdwatching@gmail.com.");
  }
}

// Optional: keep GET returning 405, or you can add a small health response:
export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405 });
}
