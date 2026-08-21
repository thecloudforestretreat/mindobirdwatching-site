// functions/api/book-tour/index.js
// MBW Book Tour proxy: Turnstile verify -> forward to Google Apps Script web app
// Required CF Pages env vars (Production):
// - TURNSTILE_SECRET_KEY
// - GAS_WEB_APP_URL   (preferred)
//   OR GAS_BOOK_TOUR_URL (legacy name supported)
// - CF_SHARED_SECRET

export async function onRequestPost({ request, env }) {
  const gasUrl = env.GAS_WEB_APP_URL || env.GAS_BOOK_TOUR_URL;
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  const sharedSecret = env.CF_SHARED_SECRET;

  function iframeReply(status, message) {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
(function(){
  try{
    parent.postMessage({ type:"mbw-booktour", status:${JSON.stringify(
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
    if (!gasUrl) return iframeReply("error", "Server misconfigured. Missing GAS_WEB_APP_URL (or GAS_BOOK_TOUR_URL).");
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

    function canonicalRequestFields(data) {
      const rawPrimary = String(data.get("preferred_tour_type") || "").trim();
      const rawAddOns = String(data.get("tour_add_ons") || "").trim();
      const rawDates = String(data.get("dates_of_visit") || "").trim();
      const guests = String(data.get("number_of_guests") || "").trim();
      const primaryKey = rawPrimary.toLowerCase();
      const primaryMap = {
        "half-day tour": { interest:"Birdwatching", service:"Birdwatching", tour:"Half-Day Birdwatching", product:"", duration:"Half Day" },
        "full-day tour": { interest:"Birdwatching", service:"Birdwatching", tour:"Full-Day Birdwatching", product:"", duration:"Full Day" },
        "photography-focused tour": { interest:"Birdwatching", service:"Birdwatching", tour:"Photography-Focused Birdwatching Tour", product:"", duration:"Flexible" },
        "night walk": { interest:"Activity", service:"Activity", tour:"Night Walk", product:"MBW016", duration:"Evening activity" },
        "quito to mindo day trip": { interest:"Birdwatching", service:"Birdwatching", tour:"Quito to Mindo Day Trip", product:"", duration:"Full Day" },
        "custom / private tour": { interest:"Birdwatching", service:"Custom", tour:"Custom / Private Tour", product:"", duration:"Flexible" },
        "not sure yet": { interest:"Other", service:"Custom", tour:"Not Sure Yet", product:"", duration:"Flexible" }
      };
      const primary = primaryMap[primaryKey] || { interest:"Other", service:"Custom", tour:rawPrimary || "Not Sure Yet", product:"", duration:"Flexible" };
      const addOnMap = {
        "night walk": { tour:"Night Walk", service_type:"Activity", product_selected:"MBW016" },
        "additional birding day": { tour:"Additional Birding Day", service_type:"Birdwatching", product_selected:"" },
        "transportation": { tour:"Transportation Requested", service_type:"Transportation", product_selected:"" },
        "accommodation assistance": { tour:"Accommodation Assistance", service_type:"Accommodation", product_selected:"ACCOM01" }
      };
      let groupingPreference = "unknown";
      const additions = [];
      rawAddOns.split(/\s*\|\s*/).filter(Boolean).forEach(value => {
        const lower = value.toLowerCase();
        if (lower.indexOf("tour format:") === 0) {
          if (lower.includes("private") && !lower.includes("either")) groupingPreference = "private_only";
          else if (lower.includes("group") || lower.includes("either")) groupingPreference = "open_to_group";
          return;
        }
        if (lower.indexOf("other:") === 0) {
          const detail = value.slice(value.indexOf(":") + 1).trim();
          additions.push({ tour:detail || "Other Activity or Tour", service_type:"Custom", product_selected:"Other" });
          return;
        }
        additions.push(addOnMap[lower] || { tour:value, service_type:"Custom", product_selected:"Other" });
      });
      const hasActivity = additions.some(item => item.service_type === "Activity");
      const hasBirding = primary.service === "Birdwatching" || additions.some(item => item.service_type === "Birdwatching");
      const interest = hasActivity && hasBirding ? "Tour + Activity" : primary.interest;
      const primaryItem = { id:"primary", tour:primary.tour, date:rawDates.split(/\s+(?:to|through|–|—)\s+/i)[0] || "", guests, product_selected:primary.product, service_type:primary.service, duration:primary.duration, status:"new", pickup_location:"", price:"", notes:"Primary request" };
      const tourItems = [primaryItem].concat(additions.map((item, index) => ({ id:"addon-" + (index + 1), tour:item.tour, date:primaryItem.date, tour_date:primaryItem.date, guests, product_selected:item.product_selected, service_type:item.service_type, duration:item.tour === "Night Walk" ? "Evening activity" : "", status:"new", pickup_location:"", price:"", notes:"Requested on website" })));
      return {
        tour_type:interest,
        tour_category:interest,
        interest_category:interest,
        service_type:primary.service,
        product_selected:primary.product,
        duration_preference:primary.duration,
        grouping_preference:groupingPreference,
        transportation_needed:additions.some(item => item.service_type === "Transportation") ? "Yes" : "Unknown",
        tour_items:JSON.stringify(tourItems),
        tour_items_json:JSON.stringify(tourItems),
        tour_count:String(tourItems.length),
        tour_content:String(tourItems.length)
      };
    }

    // Build payload for Apps Script (must include cf_secret)
    const body = new URLSearchParams();
    const canonical = canonicalRequestFields(formData);
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

        // If we got a normal OK response, return it
        if (res.status >= 200 && res.status < 300) return res;

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc = res.headers.get("location");
          if (!loc) return res;

          // For 301/302/303: follow with GET (no body) to avoid 405 at googleusercontent
          if ([301, 302, 303].includes(res.status)) {
            const follow = await fetch(loc, { method: "GET", redirect: "follow" });
            return follow;
          }

          // For 307/308: safe to repeat POST to new location
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

    if (!payload || !payload.ok) {
      return iframeReply("error", (payload && payload.message) ? payload.message : "Booking failed.");
    }

    return iframeReply("ok", "");
  } catch (e) {
    return iframeReply("error", "Server error. Please try again, or email us at mindobirdwatching@gmail.com.");
  }
}

// Keep GET returning 405 (this is fine and expected)
export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405 });
}
