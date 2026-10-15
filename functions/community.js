export function onRequest() {
  return new Response("This page has been removed.\n", {
    status: 410,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "public, max-age=300"
    }
  });
}
