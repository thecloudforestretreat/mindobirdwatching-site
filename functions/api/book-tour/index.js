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
    parent.postMessage({ type:"mbw-booktour", status:"${status}", message:"${safeMsg}" }, "*");
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

  const turnstileSecret = env.TURNSTILE_SECRET_KEY || "";
  const gasUrl = env.GAS_BOOK_TOUR_URL || "";
  const sharedSecret = env.CF_SHARED_SECRET || "";

  if (!turnstileSecret || !gasUrl || !sharedSecret) {
    return iframeReply("error", "Server configuration error.");
  }

  let formData;
  try {
    // Works for both multipart/form-data and application/x-www-form-urlencoded
    formData = await request.formData();
  } catch (e) {
    return iframeReply("error", "Invalid form data.");
  }

  // Honeypot (keep your hidden input named "website")
  if ((formData.get("website") || "").toString().trim() !== "") {
    return iframeReply("ok", "");
  }

  // Turnstile token (Cloudflare Turnstile uses this name)
  const token = (formData.get("cf-turnstile-response") || "").toString().trim();
  if (!token) {
    return iframeReply("error", "Security check failed. Please refresh and try again.");
  }

  // Verify Turnstile
  let verify;
  try {
    const ip = (request.headers.get("CF-Connecting-IP") || "").toString();
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: token,
        remoteip: ip
      })
    });
    verify = await resp.json();
  } catch (e) {
    return iframeReply("error", "Security service unavailable. Try again.");
  }

  if (!verify || verify.success !== true) {
    const code = (verify && verify["error-codes"] && verify["error-codes"][0]) ? verify["error-codes"][0] : "invalid-input-response";
    return iframeReply("error", `Security check failed. Try again. (${code})`);
  }

  // Build payload for Apps Script
  const body = new URLSearchParams();

  for (const [k, v] of formData.entries()) {
    if (k === "cf-turnstile-response") continue;
    if (k === "website") continue;
    body.append(k, v.toString());
  }

  // IMPORTANT: Apps Script expects this param
  body.append("cf_secret", sharedSecret);

  // POST to GAS and manually follow 302 redirect, re-POSTing to the Location.
  async function postWithRedirect(startUrl) {
    let current = startUrl;

    for (let i = 0; i < 3; i++) {
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

      // GAS returns 302 to script.googleusercontent.com
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) return res;
        // Handle relative Locations safely
        current = new URL(loc, current).toString();
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

  if (!payload || payload.ok !== true) {
    return iframeReply("error", (payload && payload.message) ? payload.message : "Booking failed.");
  }

  // Success (UI shows success already)
  return iframeReply("ok", payload.warning || "");
}
