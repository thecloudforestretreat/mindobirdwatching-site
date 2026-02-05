// functions/api/book-tour/index.js
// MBW Book Tour proxy: Turnstile verify -> forward to Google Apps Script web app
// Expects Cloudflare Pages env vars (Production and Preview if you test Preview):
// - TURNSTILE_SECRET_KEY
// - GAS_BOOK_TOUR_URL

export async function onRequest(context) {
  const { request, env } = context;

  // Endpoint must be POST
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
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }

  // Read env vars (allow a couple aliases to reduce misnaming pain)
  const turnstileSecret =
    (env &&
      (env.TURNSTILE_SECRET_KEY ||
        env.TURNSTILE_SECRET ||
        env.TURNSTILE_SECRETKEY)) ||
    "";
  const gasUrl =
    (env && (env.GAS_BOOK_TOUR_URL || env.GAS_URL || env.GAS_BOOKTOUR_URL)) ||
    "";

  // Fail fast if misconfigured
  if (!turnstileSecret) {
    return iframeReply(
      "error",
      "Server config error: missing TURNSTILE_SECRET_KEY in Cloudflare Pages env vars."
    );
  }
  if (!gasUrl) {
    return iframeReply(
      "error",
      "Server config error: missing GAS_BOOK_TOUR_URL in Cloudflare Pages env vars."
    );
  }

  // Accept form posts from HTML <form>
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

  // Honeypot
  if ((formData.get("website") || "").toString().trim() !== "") {
    return iframeReply("ok", "");
  }

  // Timing check (basic)
  const tsStart = Number(formData.get("ts_start") || "0");
  if (tsStart && Date.now() - tsStart < 4000) {
    return iframeReply("error", "Please slow down and try again.");
  }

  // Turnstile token from client
  const token = formData.get("cf-turnstile-response");
  if (!token) {
    return iframeReply("error", "Security check failed. Please refresh and try again.");
  }

  // Verify Turnstile
  let verifyJson;
  try {
    const verifyResp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: token.toString(),
          remoteip: request.headers.get("CF-Connecting-IP") || ""
        })
      }
    );

    verifyJson = await verifyResp.json();
  } catch (e) {
    return iframeReply("error", "Security service unavailable. Please try again.");
  }

  if (!verifyJson || !verifyJson.success) {
    const codes = Array.isArray(verifyJson && verifyJson["error-codes"])
      ? verifyJson["error-codes"].join(",")
      : "";
    const diag = codes ? ` (${codes})` : "";
    return iframeReply("error", "Security check failed. Try again." + diag);
  }

  // Forward to Apps Script as x-www-form-urlencoded
  const body = new URLSearchParams();
  for (const [k, v] of formData.entries()) {
    if (k === "cf-turnstile-response" || k === "website" || k === "ts_start") continue;
    body.append(k, v.toString());
  }

  // Call Apps Script
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

  // If Apps Script returns non-200, show error
  if (!upstream || !upstream.ok) {
    return iframeReply("error", "Booking failed. Please try again.");
  }

  // Apps Script response is expected to include a postMessage with status:"ok"
  const ok =
    text.includes('status:"ok"') ||
    text.includes("status:'ok'") ||
    text.includes('"status":"ok"');

  if (!ok) {
    return iframeReply("error", "Booking failed. Please try again.");
  }

  // Pass-through Apps Script HTML (posts status back to parent)
  return new Response(text, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
