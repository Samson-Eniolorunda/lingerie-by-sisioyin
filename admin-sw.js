/**
 * ============================================
 * SERVICE WORKER — LBS Admin
 * Lingeries by Sisioyin - Admin PWA Support
 * ============================================
 */

const SW_VERSION = "1.71.28";
const SW_BUILD = 71;
const CACHE_NAME = "lbs-admin-cache-v" + SW_BUILD;

const STATIC_ASSETS = [
  "/admin",
  "/admin.html",
  "/assets/img/favicon.svg",
  "/assets/img/favicon.png",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
  "/assets/img/monogram.svg",
  "/admin.webmanifest",
];

// Install — cache admin assets
self.addEventListener("install", (event) => {
  console.log("[Admin SW] Installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        console.log("[Admin SW] Static assets cached");
        // skipWaiting is called via message handler when app.js detects an update
      })
      .catch((err) => console.error("[Admin SW] Cache error:", err)),
  );
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  console.log("[Admin SW] Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.map((name) => {
            if (name.startsWith("lbs-admin-cache-") && name !== CACHE_NAME) {
              console.log("[Admin SW] Deleting old cache:", name);
              return caches.delete(name);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch — network-first for navigation, skip CSS/JS caching
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;

  const swHost = self.location.hostname.replace(/^www\./, "");
  const reqHost = url.hostname.replace(/^www\./, "");
  if (reqHost !== swHost) return;

  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("google") ||
    url.hostname.includes("facebook")
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      // Navigation — network first, fallback to cache
      if (request.mode === "navigate") {
        try {
          const resp = await fetch(request, { cache: "no-cache" });
          if (resp && resp.status === 200 && !resp.redirected) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, resp.clone());
          }
          return resp;
        } catch {
          const cached = await caches.match(request);
          return cached || caches.match("/admin");
        }
      }

      // CSS/JS — always fresh
      if (url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
        return fetch(request, { cache: "no-store" });
      }

      // Other assets — stale-while-revalidate
      const cached = await caches.match(request);
      if (cached) {
        event.waitUntil(
          fetch(request)
            .then((resp) => {
              if (resp && resp.status === 200 && !resp.redirected) {
                caches
                  .open(CACHE_NAME)
                  .then((c) => c.put(request, resp.clone()));
              }
            })
            .catch(() => {}),
        );
        return cached;
      }

      try {
        const resp = await fetch(request);
        if (resp && resp.status === 200 && !resp.redirected) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return resp;
      } catch {
        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});

// Messages
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "GET_VERSION") {
    event.source.postMessage({ type: "SW_VERSION", version: SW_VERSION });
  }
});

console.log("[Admin SW] v" + SW_VERSION + " loaded");
