export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  function iframeReply(status, message) {
    const safeMsg = (message || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, " ");

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
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (
    !contentType.includes("application/x-www-form-urlencoded") &&
    !contentType.includes("multipart/form-data")
  ) {
    return iframeReply("error", "Invalid submission.");
  }

  const formData = await request.formData();

  // Honeypot
  if ((formData.get("website") || "").toString().trim() !== "") {
    return iframeReply("ok", "");
  }

  // Timing check
  const tsStart = Number(formData.get("ts_start") || "0");
  if (tsStart && Date.now() - tsStart < 4000) {
    return iframeReply("error", "Please slow down and try again.");
  }

  // Turnstile
  const token = formData.get("cf-turnstile-response");
  if (!token) {
    return iframeReply("error", "Security check failed. Please refresh.");
  }

  const verify = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token.toString(),
        remoteip: request.headers.get("CF-Connecting-IP") || ""
      })
    }
  ).then(r => r.json());

  if (!verify.success) {
    return iframeReply("error", "Security check failed. Try again.");
  }

  // Forward to Apps Script
  const body = new URLSearchParams();
  for (const [k, v] of formData.entries()) {
    if (
      k === "cf-turnstile-response" ||
      k === "website" ||
      k === "ts_start"
    ) continue;
    body.append(k, v.toString());
  }

  let upstream;
  try {
    upstream = await fetch(env.GAS_BOOK_TOUR_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: body.toString()
    });
  } catch {
    return iframeReply("error", "Booking service unreachable.");
  }

  const text = await upstream.text();

  if (!upstream.ok || !text.includes('status:"ok"')) {
    return iframeReply("error", "Booking failed. Please try again.");
  }

  // Pass through Apps Script response (this triggers email + UI success)
  return new Response(text, {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}
