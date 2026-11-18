/**
 * The service worker source, shared by the storefront (`/sw.js`) and the staff area (`/admin/sw.js`).
 * It keeps three things: the offline page, the icons, and nothing else. Pages are always fetched from
 * the network, and only when the network fails is the offline page shown. Account, bag, checkout, admin
 * and API responses are never stored, so private data never lands in a cache (Q-03, Q-04, Q-08).
 */
export function serviceWorkerSource(cacheName: string, scope: "/" | "/admin"): string {
  return `const CACHE = ${JSON.stringify(cacheName)};
const SHELL = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];
const SCOPE = ${JSON.stringify(scope)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("lbs-") && k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline").then((hit) => hit || Response.error())),
    );
    return;
  }
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});
`;
}
