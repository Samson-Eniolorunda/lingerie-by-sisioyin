/**
 * ============================================
 * SERVICE WORKER
 * Lingeries by Sisioyin - PWA Offline Support
 * ============================================
 */

const SW_VERSION = "1.71.40";
const SW_BUILD = 77;
const CACHE_NAME = "lbs-cache-v" + SW_BUILD;
// Only cache HTML pages and icons for offline support
// CSS/JS are NOT cached - always fetched fresh from server
const STATIC_ASSETS = [
  "/home",
  "/home.html",
  "/shop",
  "/cart",
  "/checkout",
  "/confirmation",
  "/wishlist",
  "/dashboard",
  "/contact",
  "/faq",
  "/size",
  "/terms",
  "/privacy",
  "/track",
  "/assets/img/favicon.svg",
  "/assets/img/favicon.png",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
  "/site.webmanifest",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log("[SW] Static assets cached");
        // skipWaiting is called via message handler when app.js detects an update
      })
      .catch((err) => {
        console.error("[SW] Cache error:", err);
      }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName.startsWith("lbs-cache-") &&
              cacheName !== CACHE_NAME
            ) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log("[SW] Activated");
        return self.clients.claim();
      }),
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip caching entirely on localhost (dev environment)
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;

  // Skip external requests (CDNs, APIs)
  const swHost = self.location.hostname.replace(/^www\./, "");
  const reqHost = url.hostname.replace(/^www\./, "");
  if (reqHost !== swHost) return;

  // Skip Supabase and analytics requests
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("google") ||
    url.hostname.includes("facebook") ||
    url.hostname.includes("moniepoint")
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      // Network-first for navigations (HTML pages) — always show fresh content
      if (request.mode === "navigate") {
        try {
          // Bypass HTTP cache to ensure fresh HTML on stubborn devices
          const networkResponse = await fetch(request, { cache: "no-cache" });
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            !networkResponse.redirected
          ) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cached = await caches.match(request);
          return cached || caches.match("/home");
        }
      }

      // SKIP caching for CSS and JS — always fetch fresh from network
      const isCSSorJS =
        url.pathname.endsWith(".css") ||
        url.pathname.endsWith(".js") ||
        url.search.includes(".css") ||
        url.search.includes(".js");
      if (isCSSorJS) {
        // Force bypass HTTP cache on stubborn devices
        return fetch(request, { cache: "no-store" });
      }

      // Stale-while-revalidate for other static assets (images, fonts)
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        event.waitUntil(
          fetch(request)
            .then((networkResponse) => {
              if (
                networkResponse &&
                networkResponse.status === 200 &&
                !networkResponse.redirected
              ) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {}),
        );
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(request);
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          !networkResponse.redirected
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      } catch {
        // Return appropriate offline fallback based on request type
        const accept = request.headers.get("Accept") || "";
        if (accept.includes("image")) {
          // Return transparent 1x1 GIF for images
          return new Response(
            Uint8Array.from(
              atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
              (c) => c.charCodeAt(0),
            ),
            { status: 200, headers: { "Content-Type": "image/gif" } },
          );
        }
        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});

// Handle push notifications (future use)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || "You have a new notification",
    icon: "/assets/img/favicon.png",
    badge: "/assets/img/favicon.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/home",
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "Lingeries by Sisioyin",
      options,
    ),
  );
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/home";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});

// Listen for messages from the page
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data === "GET_VERSION") {
    event.source.postMessage({ type: "SW_VERSION", version: SW_VERSION });
  }
  if (event.data === "FORCE_UNREGISTER") {
    // Clear only our own caches and unregister
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name.startsWith("lbs-cache-")) caches.delete(name);
      });
    });
    self.registration.unregister();
  }
});

console.log("[SW] Service Worker v" + SW_VERSION + " loaded");
