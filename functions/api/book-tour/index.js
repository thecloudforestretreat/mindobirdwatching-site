// functions/api/book-tour/index.js
// MBW Book Tour proxy: Turnstile verify -> forward to Google Apps Script web app
// Required CF Pages env vars (Production):
// - TURNSTILE_SECRET_KEY
// - GAS_BOOK_TOUR_URL
// - CF_SHARED_SECRET

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  function iframeReply(status, message) {
    const safeMsg = String(message || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, " ")
      .slice(0, 800);

    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
(function(){
  try{
    parent.postMessage(
      { type:"mbw-booktour", status:"${status}", message:"${safeMsg}" },
      "*"
    );
  }catch(e){}
})();
</script>
</body></html>`,
      {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }

  const turnstileSecret = (env.TURNSTILE_SECRET_KEY || "").trim();
  const gasUrl = (env.GAS_BOOK_TOUR_URL || "").trim();
  const sharedSecret = (env.CF_SHARED_SECRET || "").trim();

  if (!turnstileSecret || !gasUrl || !sharedSecret) {
    return iframeReply("error", "Server configuration error.");
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return iframeReply("error", "Invalid submission.");
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return iframeReply("error", "Invalid form data.");
  }

  // Honeypot (bots often fill hidden fields)
  if ((formData.get("website") || "").toString().trim() !== "") {
    return iframeReply("ok", "");
  }

  // Turnstile token must be present in the submission
  const token = (formData.get("cf-turnstile-response") || "").toString().trim();
  if (!token) {
    return iframeReply(
      "error",
      "Security check missing token. Please refresh and try again."
    );
  }

  // Verify Turnstile with Cloudflare
  let verify;
  try {
    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: token,
          remoteip: request.headers.get("CF-Connecting-IP") || ""
        })
      }
    );
    verify = await resp.json();
  } catch (e) {
    return iframeReply("error", "Security service unavailable. Try again.");
  }

  if (!verify || !verify.success) {
    const code =
      verify && verify["error-codes"] ? verify["error-codes"].join(",") : "unknown";
    return iframeReply("error", `Security check failed. (${code})`);
  }

  // Build payload for Apps Script
  // IMPORTANT: Apps Script expects cf_secret in the POST body (not just a header).
  const body = new URLSearchParams();
  for (const [k, v] of formData.entries()) {
    if (k === "cf-turnstile-response") continue;
    if (k === "website") continue; // honeypot
    body.append(k, v.toString());
  }

  // Add shared secret so Apps Script can block direct bot hits
  body.set("cf_secret", sharedSecret);

  async function postWithRedirect(url) {
    let current = url;

    for (let i = 0; i < 4; i++) {
      const res = await fetch(current, {
        method: "POST",
        redirect: "manual",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: body.toString()
      });

      // Success
      if (res.status >= 200 && res.status < 300) return res;

      // Google Apps Script often responds 302 to a script.googleusercontent.com URL
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) return res;
        current = loc;
        continue;
      }

      return res;
    }

    return new Response("Too many redirects", { status: 508 });
  }

  let upstream;
  try {
    upstream = await postWithRedirect(gasUrl);
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
    return iframeReply("error", (payload && payload.message) || "Booking failed.");
  }

  return iframeReply("ok", "");
}
