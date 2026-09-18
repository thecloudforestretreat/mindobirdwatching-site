// functions/api/reviews.js
export async function onRequestGet(context) {
  const { env, request } = context;
  const cors = corsHeaders(request);

  const PLACE_ID = env.MBW_PLACE_ID;
  const API_KEY = env.GOOGLE_PLACES_API_KEY;

  if (!PLACE_ID || !API_KEY) {
    return json(
      { ok: false, error: "Missing MBW_PLACE_ID or GOOGLE_PLACES_API_KEY env vars." },
      500,
      cors
    );
  }

  // Ignore cache-busting query parameters so every consumer shares one
  // 30-minute edge-cached Google Places response.
  const cacheUrl = new URL(request.url);
  cacheUrl.searchParams.delete("ts");
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = caches.default;

  // 30 minutes
  const TTL_SECONDS = 60 * 30;

  const cached = await cache.match(cacheKey);
  if (cached) return withCors(cached, cors);

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
      502,
      cors
    );
  }

  const text = await res.text().catch(() => "");
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch (e) {
    return json(
      { ok: false, stage: "bad_json", status: res.status, raw: text.slice(0, 2000) },
      502,
      cors
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
      502,
      cors
    );
  }

  const normalized = normalizePlacesNew(body);

  const response = json(normalized, 200, {
    "Cache-Control": `public, max-age=0, s-maxage=${TTL_SECONDS}`
  });

  await cache.put(cacheKey, response.clone());
  return withCors(response, cors);
}

export async function onRequestOptions(context) {
  const cors = corsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: {
      ...cors,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
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

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = new Set([
    "https://mindobirdwatching.com",
    "https://www.mindobirdwatching.com",
    "https://admin.mindobirdwatching.com"
  ]);

  if (!allowedOrigins.has(origin)) return { "Vary": "Origin" };

  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin"
  };
}

function withCors(response, cors) {
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
