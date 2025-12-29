export async function onRequestGet({ env, caches }) {
  const PLACE_ID = env.MBW_PLACE_ID;                 // set in Cloudflare env vars
  const API_KEY  = env.GOOGLE_PLACES_API_KEY;        // set in Cloudflare env vars

  if (!PLACE_ID || !API_KEY) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }

  const cacheKey = new Request(`https://mbw.local/api/reviews?place=${PLACE_ID}`);
  const cache = caches.default;

  // ✅ cache first
  let res = await cache.match(cacheKey);
  if (res) return res;

  // ✅ Places API (new) endpoint
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}`;

  // FieldMask keeps it fast/cheap
  const fieldMask = [
    "id",
    "displayName",
    "rating",
    "userRatingCount",
    "googleMapsUri",
    "reviews"
  ].join(",");

  const upstream = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": fieldMask
    }
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(JSON.stringify({ error: "Upstream error", detail: text }), {
      status: 502,
      headers: { "content-type": "application/json" }
    });
  }

  const data = await upstream.json();

  // ✅ sanitize to what you actually render (avoid dumping everything)
  const out = {
    placeName: data?.displayName?.text || "Mindo Bird Watching",
    rating: data?.rating ?? null,
    userRatingCount: data?.userRatingCount ?? null,
    googleMapsUri: data?.googleMapsUri || null,
    reviews: Array.isArray(data?.reviews) ? data.reviews.map(r => ({
      authorName: r?.authorAttribution?.displayName || "",
      authorUri: r?.authorAttribution?.uri || "",
      rating: r?.rating ?? null,
      publishTime: r?.publishTime || "",
      relativePublishTimeDescription: r?.relativePublishTimeDescription || "",
      text: r?.text?.text || "",
      languageCode: r?.text?.languageCode || "",
    })) : []
  };

  res = new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json",
      // cache at the edge (tune as you like)
      "cache-control": "public, max-age=0, s-maxage=21600" // 6 hours
    }
  });

  // store in CF cache
  await cache.put(cacheKey, res.clone());
  return res;
}
