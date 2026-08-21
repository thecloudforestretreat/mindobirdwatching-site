// functions/api/contact/index.js
// MBW Contact proxy: Turnstile verify -> forward to Google Apps Script web app
// Required CF Pages env vars (Production):
// - TURNSTILE_SECRET_KEY
// - GAS_CONTACT_URL  (preferred)
//   OR GAS_WEB_APP_URL (fallback if you want to reuse one var)
// - CF_SHARED_SECRET

export async function onRequestPost({ request, env }) {
  const gasUrl = env.GAS_CONTACT_URL || env.GAS_WEB_APP_URL;
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  const sharedSecret = env.CF_SHARED_SECRET;

  function iframeReply(status, message) {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
(function(){
  try{
    parent.postMessage({ type:"mbw-contact", status:${JSON.stringify(
      status
    )}, message:${JSON.stringify(message || "")} }, "*");
  }catch(e){}
})();
</script>
</body></html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  try {
    if (!gasUrl) return iframeReply("error", "Server misconfigured. Missing GAS_CONTACT_URL (or GAS_WEB_APP_URL).");
    if (!turnstileSecret) return iframeReply("error", "Server misconfigured. Missing TURNSTILE_SECRET_KEY.");
    if (!sharedSecret) return iframeReply("error", "Server misconfigured. Missing CF_SHARED_SECRET.");

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return iframeReply("error", "Invalid request.");
    }

    const formData = await request.formData();

    // Honeypot
    if ((formData.get("website") || "").toString().trim() !== "") {
      // Silently accept (bot)
      return iframeReply("ok", "");
    }

    // Turnstile token from the browser
    const token = formData.get("cf-turnstile-response");
    if (!token) {
      return iframeReply("error", "Security check failed. Try again. (missing token)");
    }

    // Verify Turnstile
    let verify;
    try {
      const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: token.toString(),
          remoteip: request.headers.get("CF-Connecting-IP") || ""
        })
      });
      verify = await resp.json();
    } catch (e) {
      return iframeReply("error", "Security service unavailable.");
    }

    if (!verify || !verify.success) {
      const code =
        (verify && verify["error-codes"] && verify["error-codes"][0]) ? verify["error-codes"][0] : "invalid";
      return iframeReply("error", `Security check failed. Try again. (${code})`);
    }

    function canonicalContactFields(data) {
      const raw = String(data.get("preferred_tour_type") || "").trim();
      const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const map = {
        "half-day tour": ["Birdwatching","Birdwatching","Half-Day Birdwatching","Half Day"],
        "tour de medio dia": ["Birdwatching","Birdwatching","Half-Day Birdwatching","Half Day"],
        "full-day tour": ["Birdwatching","Birdwatching","Full-Day Birdwatching","Full Day"],
        "tour de dia completo": ["Birdwatching","Birdwatching","Full-Day Birdwatching","Full Day"],
        "custom / private tour": ["Birdwatching","Custom","Custom / Private Tour","Flexible"],
        "tour personalizado / privado": ["Birdwatching","Custom","Custom / Private Tour","Flexible"],
        "multi-day": ["Multi Day","Birdwatching","Multi-Day Birdwatching","Flexible"],
        "tour de varios dias": ["Multi Day","Birdwatching","Multi-Day Birdwatching","Flexible"],
        "quito to mindo day trip": ["Birdwatching","Birdwatching","Quito to Mindo Day Trip","Full Day"],
        "viaje de un dia de quito a mindo": ["Birdwatching","Birdwatching","Quito to Mindo Day Trip","Full Day"],
        "night walk": ["Activity","Activity","Night Walk","Evening activity"],
        "caminata nocturna": ["Activity","Activity","Night Walk","Evening activity"],
        "activities": ["Activity","Activity","Activity — details in guest message","Flexible"],
        "actividades": ["Activity","Activity","Activity — details in guest message","Flexible"],
        "combination": ["Tour + Activity","Custom","Combination of Tour and Activity","Flexible"],
        "combinacion": ["Tour + Activity","Custom","Combination of Tour and Activity","Flexible"],
        "not sure yet": ["Other","Custom","Not Sure Yet","Flexible"],
        "aun no estoy seguro": ["Other","Custom","Not Sure Yet","Flexible"]
      };
      const match = map[key] || [raw ? "Other" : "", raw ? "Custom" : "", raw, ""];
      const product = match[2] === "Night Walk" ? "MBW016" : "";
      const dates = String(data.get("dates_of_visit") || "").trim();
      const guests = String(data.get("number_of_guests") || "").trim();
      const items = match[2] ? [{ id:"primary", tour:match[2], date:dates.split(/\s+(?:to|through|–|—)\s+/i)[0] || "", guests, product_selected:product, service_type:match[1], duration:match[3], status:"new", pickup_location:"", price:"", notes:"Primary request" }] : [];
      return { tour_type:match[0], tour_category:match[0], interest_category:match[0], service_type:match[1], product_selected:product, duration_preference:match[3], tour_items:JSON.stringify(items), tour_items_json:JSON.stringify(items), tour_count:String(items.length), tour_content:String(items.length) };
    }

    // Build payload for Apps Script (must include cf_secret)
    const body = new URLSearchParams();
    const canonical = canonicalContactFields(formData);
    const canonicalKeys = new Set(Object.keys(canonical));
    for (const [k, v] of formData.entries()) {
      if (k === "cf-turnstile-response") continue;
      if (k === "website") continue;
      if (canonicalKeys.has(k)) continue;
      body.append(k, v.toString());
    }
    Object.entries(canonical).forEach(([key, value]) => body.set(key, value));

    // This is what your Apps Script checks:
    body.append("cf_secret", sharedSecret);

    // Google Apps Script often returns 302 to a googleusercontent URL.
    // For 302/303 we must follow with GET (no body) to avoid 405.
    async function fetchAppsScriptWithRedirects(url) {
      let current = url;

      for (let i = 0; i < 3; i++) {
        const res = await fetch(current, {
          method: "POST",
          redirect: "manual",
          headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: body.toString()
        });

        if (res.status >= 200 && res.status < 300) return res;

        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get("location");
          if (!loc) return res;

          if ([301, 302, 303].includes(res.status)) {
            const follow = await fetch(loc, { method: "GET", redirect: "follow" });
            return follow;
          }

          current = loc;
          continue;
        }

        return res;
      }

      return new Response("Too many redirects", { status: 508 });
    }

    let upstream;
    try {
      upstream = await fetchAppsScriptWithRedirects(gasUrl);
    } catch (e) {
      return iframeReply("error", "Contact service unreachable.");
    }

    if (!upstream.ok) {
      return iframeReply("error", `Contact failed. Upstream status=${upstream.status}.`);
    }

    let payload;
    try {
      payload = await upstream.json();
    } catch (e) {
      return iframeReply("error", "Invalid server response.");
    }

    if (!payload || !payload.ok) {
      return iframeReply("error", (payload && payload.message) ? payload.message : "Contact failed.");
    }

    return iframeReply("ok", "");
  } catch (e) {
    return iframeReply("error", "Server error. Please try again, or email us at mindobirdwatching@gmail.com.");
  }
}

export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405 });
}
