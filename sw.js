/**
 * ============================================
 * SERVICE WORKER
 * Lingerie by Sisioyin - PWA Offline Support
 * ============================================
 */

const SW_VERSION = 15;
const CACHE_NAME = "lbs-cache-v" + SW_VERSION;
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

  // Skip caching entirely on localhost (dev environment)
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;

  // Skip external requests (CDNs, APIs)
  if (!url.origin.includes(self.location.origin)) return;

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
          // Fetch with redirect: "follow" and let the server handle clean URLs
          const networkResponse = await fetch(request);
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

      // Stale-while-revalidate for static assets (CSS, JS, images)
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
      data.title || "Lingerie by Sisioyin",
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
    // Nuclear option: clear everything and unregister
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
    self.registration.unregister().then(() => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      });
    });
  }
});

console.log("[SW] Service Worker v" + SW_VERSION + " loaded");
