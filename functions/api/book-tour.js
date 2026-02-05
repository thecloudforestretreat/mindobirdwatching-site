export async function onRequestPost(context) {
  const { request, env } = context;

  function iframeReply(status, message) {
    const safeMsg = (message || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"></head><body>
        <script>
          (function(){
            try{
              parent.postMessage({type:"mbw-booktour", status:"${status}", message:"${safeMsg}"}, "*");
            }catch(e){}
          })();
        </script>
      </body></html>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");
  if (!isForm) return iframeReply("error", "Unsupported content type.");

  const formData = await request.formData();

  // Bot traps
  const honeypot = (formData.get("website") || "").toString().trim();
  if (honeypot !== "") return iframeReply("ok", "");

  const tsStart = Number((formData.get("ts_start") || "0").toString());
  if (tsStart && Date.now() - tsStart < 4000) return iframeReply("error", "Slow down and try again.");

  // Turnstile verification
  const token = formData.get("cf-turnstile-response");
  if (!token) return iframeReply("error", "Turnstile token missing. Refresh and try again.");

  const ip = request.headers.get("CF-Connecting-IP") || "";

  const verifyBody = new URLSearchParams();
  verifyBody.append("secret", env.TURNSTILE_SECRET_KEY);
  verifyBody.append("response", token.toString());
  if (ip) verifyBody.append("remoteip", ip);

  let verifyJson;
  try {
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: verifyBody.toString(),
    });
    verifyJson = await verifyRes.json();
  } catch (e) {
    return iframeReply("error", "Turnstile verification failed. Try again.");
  }

  if (!verifyJson || !verifyJson.success) {
    return iframeReply("error", "Turnstile failed. Refresh and try again.");
  }

  // Forward to Apps Script
  const forwardBody = new URLSearchParams();
  for (const [k, v] of formData.entries()) {
    if (k === "cf-turnstile-response" || k === "website" || k === "ts_start") continue;
    forwardBody.append(k, v.toString());
  }

  let forwardRes, text;
  try {
    forwardRes = await fetch(env.GAS_BOOK_TOUR_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "MBW-BookTour-Proxy/1.0"
      },
      body: forwardBody.toString(),
      redirect: "follow",
    });
    text = await forwardRes.text();
  } catch (e) {
    return iframeReply("error", "Could not reach the booking server. Try again.");
  }

  // STRICT success:
  // Your Apps Script success response contains status:"ok" in the HTML.
  const looksOk = forwardRes.ok && text && text.indexOf('status:"ok"') !== -1;

  if (looksOk) {
    // Return Apps Script HTML so the browser receives the same postMessage as before
    return new Response(text, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // If it does not look OK, show a real error (and include debug info)
  const short = (text || "").replace(/\s+/g, " ").slice(0, 220);
  return iframeReply("error", "Upstream did not confirm success. HTTP=" + String(forwardRes.status) + " Body=" + short);
}
