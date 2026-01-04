export async function onRequestGet({ env }) {
  const hasPlace = !!env?.MBW_PLACE_ID;
  const hasKey = !!env?.GOOGLE_PLACES_API_KEY;

  return new Response(
    JSON.stringify(
      {
        ok: true,
        env_check: {
          MBW_PLACE_ID: hasPlace ? "present" : "missing",
          GOOGLE_PLACES_API_KEY: hasKey ? "present" : "missing"
        }
      },
      null,
      2
    ),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}
