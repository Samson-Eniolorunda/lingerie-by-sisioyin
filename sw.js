/**
 * ============================================
 * SERVICE WORKER
 * Lingerie by Sisioyin - PWA Offline Support
 * ============================================
 */

const CACHE_NAME = "lbs-cache-v5";
const STATIC_ASSETS = [
  "/",
  "/index.html",
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
  "/assets/css/styles.css",
  "/assets/js/config.js",
  "/assets/js/utils.js",
  "/assets/js/supabase.js",
  "/assets/js/app.js",
  "/assets/js/auth.js",
  "/assets/js/analytics.js",
  "/assets/js/recaptcha.js",
  "/assets/js/home.js",
  "/assets/js/shop.js",
  "/assets/js/cart.js",
  "/assets/js/checkout.js",
  "/assets/js/confirmation.js",
  "/assets/js/wishlist.js",
  "/assets/js/dashboard.js",
  "/assets/js/contact.js",
  "/assets/js/faq.js",
  "/assets/js/size.js",
  "/assets/js/legal.js",
  "/assets/js/track.js",
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
        return self.skipWaiting();
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
            if (cacheName !== CACHE_NAME) {
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

  // Skip external requests (CDNs, APIs)
  if (!url.origin.includes(self.location.origin)) return;

  // Skip Supabase and analytics requests
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("google") ||
    url.hostname.includes("facebook") ||
    url.hostname.includes("monnify")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        // Fetch fresh copy in background
        event.waitUntil(
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {}),
        );
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(request)
        .then((networkResponse) => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Offline", { status: 503 });
        });
    }),
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
      url: data.url || "/",
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "Lingerie by Sisioyin",
      options,
    ),
  );
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";
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

console.log("[SW] Service Worker script loaded");
