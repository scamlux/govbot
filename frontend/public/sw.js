/* GovBot service worker (D1) — installable PWA + offline-readable Scenario Catalog.
 *
 * Strategies:
 *  - Navigations: network-first, falling back to the cached app shell ('/') when offline
 *    so the SPA still boots without a connection.
 *  - Built static assets (same-origin JS/CSS/img): stale-while-revalidate.
 *  - Scenario Catalog API GETs (URL contains '/scenarios'): stale-while-revalidate, so the
 *    catalog list/detail stay readable offline. Chat and other APIs are never cached.
 */
const VERSION = "govbot-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const API_CACHE = `${VERSION}-api`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === "opaque")) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache mutations (chat, feedback…)

  const url = new URL(request.url);

  // App-shell navigations: network-first, fall back to cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/", { ignoreSearch: true }))
    );
    return;
  }

  // Scenario Catalog API — keep readable offline.
  if (url.pathname.includes("/scenarios")) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Same-origin static assets.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});
