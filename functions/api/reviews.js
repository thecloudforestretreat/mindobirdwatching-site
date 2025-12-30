// functions/api/reviews.js
export async function onRequestGet(context) {
  const { env, request } = context;

  const PLACE_ID = env.MBW_PLACE_ID;
  const API_KEY = env.GOOGLE_PLACES_API_KEY;

  if (!PLACE_ID || !API_KEY) {
    return json(
      { ok: false, error: "Missing MBW_PLACE_ID or GOOGLE_PLACES_API_KEY env vars." },
      500
    );
  }

  // Cache key includes full URL (keeps it stable and safe)
  const cacheKey = new Request(request.url, request);
  const cache = caches.default;

  // 30 minutes (so new reviews appear quickly)
  const TTL_SECONDS = 60 * 30;

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Places API (Legacy) Place Details endpoint
  // Reviews are capped to "up to five" by Google; we request newest ordering.
  const fields = ["name", "url", "rating", "user_ratings_total", "reviews"].join(",");
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(PLACE_ID)}` +
    `&fields=${encodeURIComponent(fields)}` +
    `&reviews_sort=newest` +
    `&key=${encodeURIComponent(API_KEY)}`;

  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return json(
      { ok: false, error: "Google Places request failed", status: res.status, detail: text.slice(0, 2000) },
      502
    );
  }

  const raw = await res.json();
  const result = raw && raw.result ? raw.result : null;

  if (!result) {
    return json(
      { ok: false, error: "Google Places returned no result", detail: raw },
      502
    );
  }

  const normalized = {
    ok: true,
    source: "google_places_legacy",
    place: {
      name: result?.name || "",
      maps_url: result?.url || ""
    },
    summary: {
      rating: typeof result?.rating === "number" ? result.rating : null,
      review_count: typeof result?.user_ratings_total === "number" ? result.user_ratings_total : null
    },
    reviews: Array.isArray(result?.reviews)
      ? result.reviews.map((r) => ({
          author: r?.author_name || "Google user",
          author_url: r?.author_url || "",
          rating: typeof r?.rating === "number" ? r.rating : null,
          text: r?.text || "",
          relative_time: r?.relative_time_description || "",
          // Legacy returns "time" (unix seconds). Convert to ISO.
          publish_time: typeof r?.time === "number" ? new Date(r.time * 1000).toISOString() : ""
        }))
      : []
  };

  const response = json(normalized, 200, {
    "Cache-Control": `public, max-age=0, s-maxage=${TTL_SECONDS}`
  });

  await cache.put(cacheKey, response.clone());
  return response;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
