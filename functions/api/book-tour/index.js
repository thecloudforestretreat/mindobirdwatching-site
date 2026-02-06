// functions/api/book-tour/index.js
// MBW Book Tour proxy: Turnstile verify -> forward to Google Apps Script web app
// Required CF Pages env vars (Production):
// - TURNSTILE_SECRET_KEY
// - GAS_BOOK_TOUR_URL
// - CF_SHARED_SECRET

export async function onRequest(context) {
  const { request, env } = context;

  // Only POST is allowed
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  function iframeReply(status, message) {
    const safeMsg = String(message || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, " ")
      .slice(0, 900);

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
          "cache-control": "no-store",
        },
      }
    );
  }

  const turnstileSecret =
    (env &&
      (env.TURNSTILE_SECRET_KEY ||
        env.TURNSTILE_SECRET ||
        env.TURNSTILE_SECRETKEY)) ||
    "";

  const gasUrl =
    (env && (env.GAS_BOOK_TOUR_URL || env.GAS_URL || env.GAS_BOOKTOUR_URL)) ||
    "";

  const cfSharedSecret =
    (env && (env.CF_SHARED_SECRET || env.CF_SECRET || env.CF_SHARED_SECRET_KEY)) ||
    "";

  if (!turnstileSecret) {
    return iframeReply(
      "error",
      "Server config error: missing TURNSTILE_SECRET_KEY in Cloudflare Pages (Production)."
    );
  }
  if (!gasUrl) {
    return iframeReply(
      "error",
      "Server config error: missing GAS_BOOK_TOUR_URL in Cloudflare Pages (Production)."
    );
  }
  if (!cfSharedSecret) {
    return iframeReply(
      "error",
      "Server config error: missing CF_SHARED_SECRET in Cloudflare Pages (Production)."
    );
  }

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
    const verifyResp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: token.toString(),
          remoteip: request.headers.get("CF-Connecting-IP") || "",
        }),
      }
    );
    verify = await verifyResp.json();
  } catch (e) {
    return iframeReply("error", "Security service unavailable. Please try again.");
  }

  if (!verify || !verify.success) {
    const codes = Array.isArray(verify && verify["error-codes"])
      ? verify["error-codes"].join(",")
      : "";
    const diag = codes ? ` (${codes})` : "";
    return iframeReply("error", "Security check failed. Try again." + diag);
  }

  // Build urlencoded body for GAS
  const body = new URLSearchParams();

  // Add shared secret so GAS blocks direct hits
  body.append("cf_secret", cfSharedSecret);

  for (const [k, v] of formData.entries()) {
    if (k === "cf-turnstile-response" || k === "website" || k === "ts_start") continue;
    body.append(k, v.toString());
  }

  // Manual redirect helper: re-POST to the Location (do NOT turn into GET)
  async function postWithManualRedirect(url, bodyString) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      // 1) POST to /exec with redirect: manual
      const r1 = await fetch(url, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: bodyString,
        signal: controller.signal,
      });

      // If Google returns 302/303/301 to script.googleusercontent.com, we must re-POST to Location
      if (r1.status === 301 || r1.status === 302 || r1.status === 303 || r1.status === 307 || r1.status === 308) {
        const loc = r1.headers.get("location");
        if (!loc) return { ok: false, status: r1.status, text: "", note: "Missing redirect Location header." };

        const redirectUrl = new URL(loc, url).toString();

        // 2) Re-POST to redirect target
        const r2 = await fetch(redirectUrl, {
          method: "POST",
          redirect: "manual",
          headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: bodyString,
          signal: controller.signal,
        });

        const t2 = await r2.text();
        return { ok: r2.ok, status: r2.status, text: t2 };
      }

      // No redirect, just read response
      const t1 = await r1.text();
      return { ok: r1.ok, status: r1.status, text: t1 };
    } finally {
      clearTimeout(timeout);
    }
  }

  let upstream;
  try {
    upstream = await postWithManualRedirect(gasUrl, body.toString());
  } catch (e) {
    return iframeReply("error", "Booking service unreachable.");
  }

  if (!upstream || upstream.ok !== true) {
    const st = upstream && typeof upstream.status === "number" ? upstream.status : 0;
    return iframeReply("error", `Booking failed. Upstream status=${st || "unknown"}.`);
  }

  // Expect JSON from GAS: { ok: true } or { ok:false, message:"..." }
  let payload = null;
  try {
    payload = JSON.parse(upstream.text || "");
  } catch (e) {
    const preview = String(upstream.text || "").replace(/\s+/g, " ").slice(0, 180);
    return iframeReply(
      "error",
      "Booking failed. Apps Script must return JSON, but returned non-JSON. Preview: " + preview
    );
  }

  if (!payload || payload.ok !== true) {
    const msg = payload && payload.message ? String(payload.message) : "Booking failed. Please try again.";
    return iframeReply("error", msg);
  }

  return iframeReply("ok", payload.warning ? String(payload.warning) : "");
}
