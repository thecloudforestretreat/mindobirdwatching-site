export async function onRequestPost(context) {
  const { request, env } = context;

  const contentType = request.headers.get("content-type") || "";
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  if (!isForm) return new Response("Unsupported content type", { status: 415 });

  const formData = await request.formData();

  // Bot trap: if honeypot field is filled, drop it silently
  const honeypot = (formData.get("website") || "").toString().trim();
  if (honeypot !== "") {
    return new Response("OK", { status: 200 });
  }

  // Optional: time-on-page check (requires ts_start hidden field)
  const tsStart = Number((formData.get("ts_start") || "0").toString());
  if (tsStart && Date.now() - tsStart < 4000) {
    return new Response("Slow down", { status: 429 });
  }

  // Turnstile server-side verification
  const token = formData.get("cf-turnstile-response");
  if (!token) return new Response("Missing Turnstile token", { status: 400 });

  const ip = request.headers.get("CF-Connecting-IP") || "";

  const verifyBody = new URLSearchParams();
  verifyBody.append("secret", env.TURNSTILE_SECRET_KEY);
  verifyBody.append("response", token.toString());
  if (ip) verifyBody.append("remoteip", ip);

  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: verifyBody.toString(),
  });

  const verifyJson = await verifyRes.json();
  if (!verifyJson.success) {
    return new Response("Turnstile failed", { status: 403 });
  }

  // Forward to Google Apps Script
  const forwardBody = new URLSearchParams();
  for (const [k, v] of formData.entries()) {
    if (k === "cf-turnstile-response" || k === "website" || k === "ts_start") continue;
    forwardBody.append(k, v.toString());
  }

  const forwardRes = await fetch(env.GAS_BOOK_TOUR_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: forwardBody.toString(),
  });

  if (!forwardRes.ok) return new Response("Upstream error", { status: 502 });

  return new Response("OK", { status: 200 });
}
