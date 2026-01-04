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

  // Cache key includes full URL
  const cacheKey = new Request(request.url, request);
  const cache = caches.default;

  // 30 minutes
  const TTL_SECONDS = 60 * 30;

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Places API (New)
  // IMPORTANT: FieldMask is required
  const fields = [
    "displayName",
    "googleMapsUri",
    "rating",
    "userRatingCount",
    "reviews"
  ].join(",");

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}`;

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": fields
      }
    });
  } catch (e) {
    return json(
      { ok: false, stage: "fetch_failed", error: String(e && e.message ? e.message : e) },
      502
    );
  }

  const text = await res.text().catch(() => "");
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch (e) {
    return json(
      { ok: false, stage: "bad_json", status: res.status, raw: text.slice(0, 2000) },
      502
    );
  }

  if (!res.ok) {
    return json(
      {
        ok: false,
        stage: "google_api_error",
        http_status: res.status,
        google_status: body && body.error && body.error.status ? body.error.status : null,
        google_error_message: body && body.error && body.error.message ? body.error.message : null,
        body
      },
      502
    );
  }

  const normalized = normalizePlacesNew(body);

  const response = json(normalized, 200, {
    "Cache-Control": `public, max-age=0, s-maxage=${TTL_SECONDS}`
  });

  await cache.put(cacheKey, response.clone());
  return response;
}

function normalizePlacesNew(place) {
  const name =
    place && place.displayName && typeof place.displayName.text === "string"
      ? place.displayName.text
      : "";

  const mapsUrl = place && typeof place.googleMapsUri === "string" ? place.googleMapsUri : "";

  const rating = typeof place && typeof place.rating === "number" ? place.rating : null;
  const reviewCount =
    place && typeof place.userRatingCount === "number" ? place.userRatingCount : null;

  const reviews = Array.isArray(place && place.reviews) ? place.reviews : [];

  // NOTE: Google limits the number of reviews returned by the API (often ~5).
  const outReviews = reviews.map((r) => {
    const author = r && r.authorAttribution && r.authorAttribution.displayName
      ? r.authorAttribution.displayName
      : "Google user";

    const authorUrl = r && r.authorAttribution && r.authorAttribution.uri
      ? r.authorAttribution.uri
      : "";

    const rel = r && typeof r.relativePublishTimeDescription === "string"
      ? r.relativePublishTimeDescription
      : "";

    const publish = r && typeof r.publishTime === "string" ? r.publishTime : "";

    return {
      author,
      author_url: authorUrl,
      rating: typeof r && typeof r.rating === "number" ? r.rating : null,
      text: r && typeof r.text === "object" && typeof r.text.text === "string" ? r.text.text : "",
      relative_time: rel,
      publish_time: publish
    };
  });

  return {
    ok: true,
    source: "places_api_new",
    place: { name, maps_url: mapsUrl },
    summary: { rating, review_count: reviewCount },
    reviews: outReviews
  };
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
