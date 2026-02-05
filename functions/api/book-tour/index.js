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
      `<!doctype html><html><body>
<script>
try{
  parent.postMessage(
    { type:"mbw-booktour", status:"${status}", message:"${safeMsg}" },
    "*"
  );
}catch(e){}
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

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return iframeReply("error", "Invalid submission.");
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return iframeReply("error", "Invalid form data.");
  }

  // Honeypot
  if ((formData.get("website") || "").trim() !== "") {
    return iframeReply("ok", "");
  }

  // Turnstile
  const token = formData.get("cf-turnstile-response");
  if (!token) {
    return iframeReply("error", "Security check failed.");
  }

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
  } catch {
    return iframeReply("error", "Security service unavailable.");
  }

  if (!verify.success) {
    return iframeReply("error", "Security check failed.");
  }

  // Build payload for Apps Script
  const body = new URLSearchParams();
  for (const [k, v] of formData.entries()) {
    if (["cf-turnstile-response", "website"].includes(k)) continue;
    body.append(k, v.toString());
  }

  async function postWithRedirect(url) {
    let current = url;
    for (let i = 0; i < 3; i++) {
      const res = await fetch(current, {
        method: "POST",
        redirect: "manual",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "x-cf-shared-secret": sharedSecret
        },
        body: body.toString()
      });

      if (res.status >= 200 && res.status < 300) return res;

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
  } catch {
    return iframeReply("error", "Booking service unreachable.");
  }

  if (!upstream.ok) {
    return iframeReply("error", `Booking failed. Upstream status=${upstream.status}.`);
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return iframeReply("error", "Invalid server response.");
  }

  if (!payload.ok) {
    return iframeReply("error", payload.message || "Booking failed.");
  }

  return iframeReply("ok", "");
}
