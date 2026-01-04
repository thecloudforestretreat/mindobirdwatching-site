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

  // Cache
  const cacheKey = new Request(request.url, request);
  const cache = caches.default;
  const TTL_SECONDS = 60 * 30;

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Places API (New) - Place Details
  // NOTE: FieldMask is REQUIRED for Places API (New)
  const endpoint = `https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}`;

  // We only request what we need
  const fieldMask = [
    "displayName",
    "googleMapsUri",
    "rating",
    "userRatingCount",
    "reviews"
  ].join(",");

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": fieldMask
    }
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    // Try to parse JSON error if possible
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return json(
      {
        ok: false,
        stage: "google_api_error",
        http_status: res.status,
        body: body || text.slice(0, 2000)
      },
      502
    );
  }

  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!data) {
    return json(
      { ok: false, stage: "parse_error", detail: text.slice(0, 2000) },
      502
    );
  }

  const normalized = {
    ok: true,
    source: "places_api_new",
    place: {
      name: data?.displayName?.text || "",
      maps_url: data?.googleMapsUri || ""
    },
    summary: {
      rating: typeof data?.rating === "number" ? data.rating : null,
      review_count: typeof data?.userRatingCount === "number" ? data.userRatingCount : null
    },
    reviews: Array.isArray(data?.reviews)
      ? data.reviews.map((r) => ({
          author: r?.authorAttribution?.displayName || "Google user",
          author_url: r?.authorAttribution?.uri || "",
          rating: typeof r?.rating === "number" ? r.rating : null,
          text: r?.text?.text || "",
          relative_time: r?.relativePublishTimeDescription || "",
          publish_time: r?.publishTime || ""
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
