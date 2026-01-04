export async function onRequestGet({ env }) {
  const PLACE_ID = env.MBW_PLACE_ID;
  const API_KEY = env.GOOGLE_PLACES_API_KEY;

  const fields = ["name", "url", "rating", "user_ratings_total", "reviews"].join(",");
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(PLACE_ID)}` +
    `&fields=${encodeURIComponent(fields)}` +
    `&reviews_sort=newest` +
    `&key=${encodeURIComponent(API_KEY)}`;

  let res;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    return json(
      { ok: false, stage: "fetch_throw", message: String(e?.message || e) },
      502
    );
  }

  const text = await res.text().catch(() => "");

  // If Google returns an error, we want to see it.
  if (!res.ok) {
    return json(
      {
        ok: false,
        stage: "google_http_error",
        status: res.status,
        statusText: res.statusText,
        body_preview: text.slice(0, 2000)
      },
      502
    );
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return json(
      {
        ok: false,
        stage: "json_parse_error",
        body_preview: text.slice(0, 2000)
      },
      502
    );
  }

  // Google-level errors are often inside JSON even with 200 OK
  if (data?.status && data.status !== "OK") {
    return json(
      {
        ok: false,
        stage: "google_api_error",
        google_status: data.status,
        google_error_message: data.error_message || "",
        body: data
      },
      502
    );
  }

  return json(
    {
      ok: true,
      stage: "google_ok",
      place_name: data?.result?.name || "",
      rating: data?.result?.rating ?? null,
      user_ratings_total: data?.result?.user_ratings_total ?? null,
      reviews_count: Array.isArray(data?.result?.reviews) ? data.result.reviews.length : 0
    },
    200
  );
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
