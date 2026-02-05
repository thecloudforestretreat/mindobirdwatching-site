// functions/api/book-tour/index.js
// MBW Book Tour proxy: Turnstile verify -> forward to Google Apps Script web app
// Env vars (Production):
// - TURNSTILE_SECRET_KEY
// - GAS_BOOK_TOUR_URL

export async function onRequest(context) {
  const { request, env } = context;

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

  const turnstileSecret = (env && env.TURNSTILE_SECRET_KEY) ? String(env.TURNSTILE_SECRET_KEY) : "";
  const gasUrl = (env && env.GAS_BOOK_TOUR_URL) ? String(env.GAS_BOOK_TOUR_URL) : "";

  if (!turnstileSecret) return iframeReply("error", "Server config error: missing TURNSTILE_SECRET_KEY.");
  if (!gasUrl) return iframeReply("error", "Server config error: missing GAS_BOOK_TOUR_URL.");

  const contentType = request.headers.get("content-type") || "";
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");
  if (!isForm) return iframeReply("error", "Invalid submission.");

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

  // Timing check
  const tsStart = Number(formData.get("ts_start") || "0");
  if (tsStart && Date.now() - tsStart < 4000) {
    return iframeReply("error", "Please slow down and try again.");
  }

  // Turnstile token
  const token = formData.get("cf-turnstile-response");
  if (!token) return iframeReply("error", "Security check failed. Please refresh and try again.");

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
    return iframeReply("error", codes ? ("Security check failed. (" + codes + ")") : "Security check failed.");
  }

  // Forward to Apps Script
  const body = new URLSearchParams();
  for (const [k, v] of formData.entries()) {
    if (k === "cf-turnstile-response" || k === "website" || k === "ts_start") continue;
    body.append(k, v.toString());
  }

  let upstream;
  let text = "";
  let status = 0;

  try {
    upstream = await fetch(gasUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString()
    });
    status = upstream.status;
    text = await upstream.text();
  } catch (e) {
    return iframeReply("error", "Booking service unreachable (fetch failed).");
  }

  // Accept a few common "ok" formats
  const ok =
    (status >= 200 && status < 300) &&
    (
      text.includes('status:"ok"') ||
      text.includes("status:'ok'") ||
      text.includes('"status":"ok"') ||
      text.includes('"status": "ok"') ||
      text.includes("status=ok") ||
      text.trim() === "ok" ||
      text.trim() === "OK"
    );

  if (!ok) {
    const preview = String(text || "")
      .replace(/\s+/g, " ")
      .slice(0, 220);
    return iframeReply(
      "error",
      "Booking failed. Upstream status=" + status + ". Response preview: " + preview
    );
  }

  // Pass through the Apps Script response (expected to postMessage success)
  return new Response(text, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
