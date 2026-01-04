export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "Pages Function is alive"
    }),
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
