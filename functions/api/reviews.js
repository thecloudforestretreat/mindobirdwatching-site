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

  // Simple edge cache (Cloudflare Cache API)
  const cacheKey = new Request(new URL("/api/reviews", request.url).toString(), request);
  const cache = caches.default;

  // 12 hours
  const TTL_SECONDS = 60 * 60 * 12;

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Places API (New) Place Details endpoint
  // FieldMask is REQUIRED (or Google returns an error).  [oai_citation:1‡Google for Developers](https://developers.google.com/maps/documentation/places/web-service/place-details)
  const fieldMask = [
    "displayName",
    "googleMapsUri",
    "rating",
    "userRatingCount",
    "reviews" // includes review text/rating/author attribution fields where available
  ].join(",");

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}?fields=${encodeURIComponent(fieldMask)}&key=${encodeURIComponent(API_KEY)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // Using URL fields= already supplies the mask, but keeping the header is fine and explicit.
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": fieldMask
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return json(
      { ok: false, error: "Google Places request failed", status: res.status, detail: text.slice(0, 2000) },
      502
    );
  }

  const data = await res.json();

  const normalized = {
    ok: true,
    source: "google_places_new",
    place: {
      name: data?.displayName?.text || "",
      maps_url: data?.googleMapsUri || ""
    },
    summary: {
      rating: typeof data?.rating === "number" ? data.rating : null,
      review_count: typeof data?.userRatingCount === "number" ? data.userRatingCount : null
    },
    // Google may return a limited subset of reviews depending on availability/policy.
    reviews: Array.isArray(data?.reviews)
      ? data.reviews.map((r) => ({
          author: r?.authorAttribution?.displayName || "Google user",
          author_url: r?.authorAttribution?.uri || "",
          rating: typeof r?.rating === "number" ? r.rating : null,
          // In Places API (New), text is often nested as text.text
          text: r?.text?.text || "",
          relative_time: r?.relativePublishTimeDescription || "",
          publish_time: r?.publishTime || ""
        }))
      : []
  };

  const response = json(normalized, 200, {
    "Cache-Control": `public, max-age=0, s-maxage=${TTL_SECONDS}`
  });

  // Store in edge cache
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
