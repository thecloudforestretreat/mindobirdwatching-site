// functions/api/book-tour/index.js
// MBW Book Tour proxy: Turnstile verify -> forward to Google Apps Script web app
// Expects CF Pages env vars (Production):
// - TURNSTILE_SECRET_KEY
// - GAS_BOOK_TOUR_URL

export async function onRequest(context) {
  const { request, env } = context;

  // Only POST is allowed
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  function iframeReply(status, message) {
    const safeMsg = String(message || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, " ")
      .slice(0, 1200);

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
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }

  // Env vars
  const turnstileSecret = (env && env.TURNSTILE_SECRET_KEY) ? String(env.TURNSTILE_SECRET_KEY) : "";
  const gasUrl = (env && env.GAS_BOOK_TOUR_URL) ? String(env.GAS_BOOK_TOUR_URL) : "";

  if (!turnstileSecret) {
    return iframeReply("error", "Server config error: missing TURNSTILE_SECRET_KEY.");
  }
  if (!gasUrl) {
    return iframeReply("error", "Server config error: missing GAS_BOOK_TOUR_URL.");
  }

  // Accept standard form posts
  const contentType = request.headers.get("content-type") || "";
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  if (!isForm) {
    return iframeReply("error", "Invalid submission.");
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return iframeReply("error", "Invalid form data.");
  }

  // Honeypot (bots)
  if ((formData.get("website") || "").toString().trim() !== "") {
    return iframeReply("ok", "");
  }

  // Timing check
  const tsStart = Number(formData.get("ts_start") || "0");
  if (tsStart && Date.now() - tsStart < 4000) {
    return iframeReply("error", "Please slow down and try again.");
  }

  // Turnstile token
  const token = formData.get("cf-turnstile-response");
  if (!token) {
    return iframeReply("error", "Security check failed. Please refresh and try again.");
  }

  // Verify Turnstile
  let verify;
  try {
    const verifyResp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: token.toString(),
        remoteip: request.headers.get("CF-Connecting-IP") || ""
      })
    });
    verify = await verifyResp.json();
  } catch (e) {
    return iframeReply("error", "Security service unavailable. Please try again.");
  }

  if (!verify || !verify.success) {
    const codes = Array.isArray(verify && verify["error-codes"]) ? verify["error-codes"].join(",") : "";
    const diag = codes ? ` (${codes})` : "";
    return iframeReply("error", "Security check failed. Try again." + diag);
  }

  // Forward to Apps Script
  const body = new URLSearchParams();
  for (const [k, v] of formData.entries()) {
    if (k === "cf-turnstile-response" || k === "website" || k === "ts_start") continue;
    body.append(k, v.toString());
  }

  let upstream;
  let text = "";
  try {
    upstream = await fetch(gasUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString()
    });
    text = await upstream.text();
  } catch (e) {
    return iframeReply("error", "Booking service unreachable.");
  }

  // If Apps Script is throwing, it often returns a generic HTML page.
  // Show a short preview so you can see what it returned.
  const preview = String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, 260);

  if (!upstream.ok) {
    return iframeReply("error", "Booking failed. Upstream HTTP " + upstream.status + ". Preview: " + preview);
  }

  // Success markers we accept from GAS.
  // Recommended: have GAS return {"status":"ok"} or status:"ok" in its body.
  const okMarker =
    text.includes('status:"ok"') ||
    text.includes("status:'ok'") ||
    text.includes('"status":"ok"') ||
    text.includes('"status":"OK"') ||
    text.includes("status=ok");

  if (okMarker) {
    // If GAS already returns an iframe postMessage HTML, pass it through.
    // Otherwise, just return our own "ok" message.
    if (text.includes("parent.postMessage") && text.includes("mbw-booktour")) {
      return new Response(text, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
    return iframeReply("ok", "Your request has been sent. We will email you a confirmation shortly.");
  }

  // If it's clearly an Apps Script HTML shell, it probably did not run your doPost logic
  // (or it errored). Return a helpful message with preview.
  const looksLikeGasHtml =
    text.includes("<!doctype html") ||
    text.includes("<html") ||
    text.includes("script.google.com") ||
    text.includes('meta name="chromevox"') ||
    text.includes("googleapis.com/icon");

  if (looksLikeGasHtml) {
    return iframeReply(
      "error",
      "Booking failed. Apps Script returned an HTML page instead of an OK response. Preview: " + preview
    );
  }

  return iframeReply("error", "Booking failed. Unexpected response. Preview: " + preview);
}
