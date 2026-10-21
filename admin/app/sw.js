const CACHE = "mbw-mobile-shell-v20";
const SHELL = ["/app/", "/app/app.css?v=nest-20261020-v15", "/app/app.mjs?v=nest-20261020-v14", "/app/modules/api.mjs?v=services-20261020-v8", "/app/modules/cache.mjs", "/app/modules/action-desk.mjs?v=services-20261020-v8", "/site.webmanifest?v=nest-20261020-v4", "/assets/images/app/mbw-header-logo-160.png?v=header-20261020", "/assets/images/app/mbw-nest-ios-v1-180.png", "/assets/images/app/mbw-nest-ios-v1-192.png", "/assets/images/app/mbw-nest-ios-v1-512.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (!url.pathname.startsWith("/app/") && !url.pathname.startsWith("/assets/images/app/") && !["/site.webmanifest", "/favicon.ico"].includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === "basic") caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(response => response || caches.match("/app/"))));
});
