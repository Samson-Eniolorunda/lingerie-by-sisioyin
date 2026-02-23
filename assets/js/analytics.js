/**
 * ============================================
 * ANALYTICS MODULE
 * Lingeries by Sisioyin - Google Analytics & Facebook Pixel
 * ============================================
 */
(function () {
  "use strict";
  console.log("📊 ANALYTICS: Module initializing");

  /* ─────────────────────────────────────────────
   * Configuration
   * ───────────────────────────────────────────── */
  const config = window.APP_CONFIG || {};
  const GA_ID = config.GA_MEASUREMENT_ID || "";
  const FB_ID = config.FB_PIXEL_ID || "";

  /* ─────────────────────────────────────────────
   * Google Analytics 4 (gtag.js)
   * ───────────────────────────────────────────── */
  function initGoogleAnalytics() {
    if (!GA_ID) {
      console.log("📊 ANALYTICS: GA Measurement ID not configured");
      return;
    }

    console.log("📊 ANALYTICS: Initializing Google Analytics:", GA_ID);

    // Load gtag.js script
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    // Initialize dataLayer and gtag function
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      page_title: document.title,
      page_location: window.location.href,
    });

    console.log("✅ ANALYTICS: Google Analytics initialized");
  }

  /* ─────────────────────────────────────────────
   * Facebook Pixel
   * ───────────────────────────────────────────── */
  function initFacebookPixel() {
    if (!FB_ID) {
      console.log("📊 ANALYTICS: FB Pixel ID not configured");
      return;
    }

    console.log("📊 ANALYTICS: Initializing Facebook Pixel:", FB_ID);

    // Facebook Pixel base code
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(
      window,
      document,
      "script",
      "https://connect.facebook.net/en_US/fbevents.js",
    );

    window.fbq("init", FB_ID);
    window.fbq("track", "PageView");

    console.log("✅ ANALYTICS: Facebook Pixel initialized");
  }

  /* ─────────────────────────────────────────────
   * E-commerce Tracking Events
   * ───────────────────────────────────────────── */
  const Analytics = {
    // Track page view (called automatically)
    pageView: function (pageName) {
      if (window.gtag && GA_ID) {
        window.gtag("event", "page_view", {
          page_title: pageName || document.title,
          page_location: window.location.href,
        });
      }
      if (window.fbq && FB_ID) {
        window.fbq("track", "PageView");
      }
    },

    // Track product view
    viewProduct: function (product) {
      if (!product) return;
      console.log("📊 ANALYTICS: View Product", product.name);

      if (window.gtag && GA_ID) {
        window.gtag("event", "view_item", {
          currency: "NGN",
          value: product.price || 0,
          items: [
            {
              item_id: product.id,
              item_name: product.name,
              item_category: product.category,
              price: product.price || 0,
            },
          ],
        });
      }

      if (window.fbq && FB_ID) {
        window.fbq("track", "ViewContent", {
          content_ids: [product.id],
          content_name: product.name,
          content_category: product.category,
          content_type: "product",
          value: product.price || 0,
          currency: "NGN",
        });
      }
    },

    // Track add to cart
    addToCart: function (product, quantity = 1) {
      if (!product) return;
      console.log("📊 ANALYTICS: Add to Cart", product.name, "x", quantity);

      if (window.gtag && GA_ID) {
        window.gtag("event", "add_to_cart", {
          currency: "NGN",
          value: (product.price || 0) * quantity,
          items: [
            {
              item_id: product.id,
              item_name: product.name,
              item_category: product.category,
              price: product.price || 0,
              quantity: quantity,
            },
          ],
        });
      }

      if (window.fbq && FB_ID) {
        window.fbq("track", "AddToCart", {
          content_ids: [product.id],
          content_name: product.name,
          content_type: "product",
          value: (product.price || 0) * quantity,
          currency: "NGN",
        });
      }
    },

    // Track add to wishlist
    addToWishlist: function (product) {
      if (!product) return;
      console.log("📊 ANALYTICS: Add to Wishlist", product.name);

      if (window.gtag && GA_ID) {
        window.gtag("event", "add_to_wishlist", {
          currency: "NGN",
          value: product.price || 0,
          items: [
            {
              item_id: product.id,
              item_name: product.name,
              item_category: product.category,
              price: product.price || 0,
            },
          ],
        });
      }

      if (window.fbq && FB_ID) {
        window.fbq("track", "AddToWishlist", {
          content_ids: [product.id],
          content_name: product.name,
          value: product.price || 0,
          currency: "NGN",
        });
      }
    },

    // Track begin checkout
    beginCheckout: function (items, total) {
      console.log("📊 ANALYTICS: Begin Checkout, total:", total);

      if (window.gtag && GA_ID) {
        window.gtag("event", "begin_checkout", {
          currency: "NGN",
          value: total || 0,
          items: (items || []).map((item) => ({
            item_id: item.id,
            item_name: item.name,
            price: item.price || 0,
            quantity: item.quantity || 1,
          })),
        });
      }

      if (window.fbq && FB_ID) {
        window.fbq("track", "InitiateCheckout", {
          content_ids: (items || []).map((i) => i.id),
          num_items: items?.length || 0,
          value: total || 0,
          currency: "NGN",
        });
      }
    },

    // Track purchase
    purchase: function (orderId, items, total, paymentMethod) {
      console.log("📊 ANALYTICS: Purchase", orderId, "total:", total);

      if (window.gtag && GA_ID) {
        window.gtag("event", "purchase", {
          transaction_id: orderId,
          value: total || 0,
          currency: "NGN",
          payment_type: paymentMethod || "card",
          items: (items || []).map((item) => ({
            item_id: item.id,
            item_name: item.name,
            price: item.price || 0,
            quantity: item.quantity || 1,
          })),
        });
      }

      if (window.fbq && FB_ID) {
        window.fbq("track", "Purchase", {
          content_ids: (items || []).map((i) => i.id),
          content_type: "product",
          num_items: items?.length || 0,
          value: total || 0,
          currency: "NGN",
        });
      }
    },

    // Track search
    search: function (query) {
      console.log("📊 ANALYTICS: Search", query);

      if (window.gtag && GA_ID) {
        window.gtag("event", "search", {
          search_term: query,
        });
      }

      if (window.fbq && FB_ID) {
        window.fbq("track", "Search", {
          search_string: query,
        });
      }
    },

    // Track newsletter signup
    newsletterSignup: function (email) {
      console.log("📊 ANALYTICS: Newsletter Signup");

      if (window.gtag && GA_ID) {
        window.gtag("event", "sign_up", {
          method: "newsletter",
        });
      }

      if (window.fbq && FB_ID) {
        window.fbq("track", "Lead", {
          content_name: "Newsletter Subscription",
        });
      }
    },

    // Track user login
    login: function (method) {
      console.log("📊 ANALYTICS: Login", method);

      if (window.gtag && GA_ID) {
        window.gtag("event", "login", {
          method: method || "email",
        });
      }
    },

    // Track user signup
    signup: function (method) {
      console.log("📊 ANALYTICS: Signup", method);

      if (window.gtag && GA_ID) {
        window.gtag("event", "sign_up", {
          method: method || "email",
        });
      }

      if (window.fbq && FB_ID) {
        window.fbq("track", "CompleteRegistration", {
          content_name: "User Registration",
        });
      }
    },
  };

  /* ─────────────────────────────────────────────
   * Initialize
   * ───────────────────────────────────────────── */
  async function init() {
      console.log("[init]");
    initGoogleAnalytics();
    initFacebookPixel();
    await trackDeviceType();
    trackVisitorLocation();
    trackTimeSpent();
    console.log("✅ ANALYTICS: Module initialized");
  }

  /* ─────────────────────────────────────────────
   * Device Type Tracking
   * ───────────────────────────────────────────── */
  async function trackDeviceType() {
      console.log("[trackDeviceType]");
    try {
      if (sessionStorage.getItem("lbs_device_tracked")) return;

      const ua = navigator.userAgent || "";
      const width = window.innerWidth;
      let deviceType = "desktop";
      if (/Mobi|Android/i.test(ua) || width < 768) deviceType = "mobile";
      else if (/Tablet|iPad/i.test(ua) || (width >= 768 && width < 1024))
        deviceType = "tablet";

      const browser = (() => {
        if (ua.includes("Edg")) return "Edge";
        if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
        if (ua.includes("Firefox")) return "Firefox";
        if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
        if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
        return "Other";
      })();

      const os = (() => {
        if (ua.includes("Windows")) return "Windows";
        if (ua.includes("Mac")) return "macOS";
        if (ua.includes("Linux") && !ua.includes("Android")) return "Linux";
        if (ua.includes("Android")) return "Android";
        if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
        return "Other";
      })();

      // Detect device brand & model from UA string
      const { brand: deviceBrand, model: deviceModel } = (() => {
        // Samsung — SM-S9xx (Galaxy S2x), SM-Axxx, SM-Fxxx, SM-Gxxx, SM-Nxxx
        const sm = ua.match(/SM-([A-Z]\d{3,4}[A-Za-z]*)/i);
        if (sm) {
          const code = sm[1].toUpperCase();
          let model = code;
          if (/^S9[012]\d/.test(code)) model = "Galaxy S2" + (code[2] === "0" ? "4" : code[2] === "1" ? "4" : code[2] === "2" ? "5" : "x");
          else if (/^S7[0-9]\d/.test(code)) model = "Galaxy S2" + (parseInt(code[2]) < 5 ? "3" : "3");
          else if (/^A\d{3}/.test(code)) model = "Galaxy A" + code.slice(1, 3);
          else if (/^F\d{3}/.test(code)) model = "Galaxy Z Fold";
          else if (/^N\d{3}/.test(code)) model = "Galaxy Note";
          else if (/^G\d{3}/.test(code)) model = "Galaxy S";
          return { brand: "Samsung", model: model };
        }
        if (/Samsung/i.test(ua)) return { brand: "Samsung", model: "Samsung" };

        // iPhone / iPad / iPod
        if (/iPhone/.test(ua)) return { brand: "Apple", model: "iPhone" };
        if (/iPad/.test(ua)) return { brand: "Apple", model: "iPad" };
        if (/iPod/.test(ua)) return { brand: "Apple", model: "iPod" };
        if (/Macintosh/.test(ua)) return { brand: "Apple", model: "Mac" };

        // Google Pixel
        const pixel = ua.match(/Pixel\s?(\d[a-zA-Z]?\s?(?:Pro|XL)?)/i);
        if (pixel) return { brand: "Google", model: "Pixel " + pixel[1].trim() };
        if (/Pixel/i.test(ua)) return { brand: "Google", model: "Pixel" };

        // Xiaomi / Redmi / POCO
        const xiaomi = ua.match(/(Redmi\s?Note\s?\d+\s?\w*|Redmi\s?\d+\w*|POCO\s?\w+\d*|Mi\s?\d+\w*)/i);
        if (xiaomi) return { brand: "Xiaomi", model: xiaomi[1].trim() };
        if (/Xiaomi/i.test(ua)) return { brand: "Xiaomi", model: "Xiaomi" };

        // Huawei
        const huawei = ua.match(/HUAWEI\s?(\S+)/i) || ua.match(/(VOG|ELS|NOH|OCE|ABR|CET|ALN)-\w+/i);
        if (huawei) return { brand: "Huawei", model: huawei[1] };

        // OnePlus
        const oneplus = ua.match(/(ONEPLUS\s?\w+|IN20\d{2}|KB20\d{2}|CPH\d{4}|NE2\d{3})/i);
        if (oneplus) return { brand: "OnePlus", model: oneplus[1] };

        // Oppo
        if (/OPPO/i.test(ua)) {
          const oppoModel = ua.match(/OPPO\s?(\S+)/i);
          return { brand: "Oppo", model: oppoModel ? oppoModel[1] : "Oppo" };
        }

        // Vivo
        if (/vivo/i.test(ua)) {
          const vivoModel = ua.match(/vivo\s?(\S+)/i);
          return { brand: "Vivo", model: vivoModel ? vivoModel[1] : "Vivo" };
        }

        // Tecno
        const tecno = ua.match(/TECNO\s?(\S+)/i);
        if (tecno) return { brand: "Tecno", model: tecno[1] };

        // Infinix
        const infinix = ua.match(/Infinix\s?(\S+)/i);
        if (infinix) return { brand: "Infinix", model: infinix[1] };

        // Itel
        const itel = ua.match(/itel\s?(\S+)/i);
        if (itel) return { brand: "Itel", model: itel[1] };

        // LG
        const lg = ua.match(/LG-?(\S+)/i);
        if (lg) return { brand: "LG", model: lg[1] };

        // Nokia / HMD
        const nokia = ua.match(/Nokia\s?(\S+)/i);
        if (nokia) return { brand: "Nokia", model: nokia[1] };

        // Windows desktop
        if (/Windows NT/i.test(ua)) return { brand: "PC", model: "Windows PC" };
        // Linux desktop
        if (/Linux/i.test(ua) && !/Android/i.test(ua)) return { brand: "PC", model: "Linux PC" };
        // Generic Android
        if (/Android/i.test(ua)) {
          const genericModel = ua.match(/;\s*([^;)]+)\s*Build/i);
          if (genericModel) return { brand: "Android", model: genericModel[1].trim().slice(0, 30) };
          return { brand: "Android", model: "Android" };
        }

        return { brand: "Unknown", model: "Unknown" };
      })();

      // Try high-entropy UA data for better model info (Chromium only)
      let heBrand = deviceBrand, heModel = deviceModel;
      try {
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
          const he = await navigator.userAgentData.getHighEntropyValues(["model", "platform"]);
          if (he.model) heModel = he.model;
          if (he.platform === "Android" && heBrand === "Unknown") heBrand = "Android";
        }
      } catch (_) { /* not supported */ }

      // Send to GA4
      if (window.gtag && GA_ID) {
        window.gtag("event", "device_info", {
          device_type: deviceType,
          browser: browser,
          operating_system: os,
          device_brand: heBrand,
          device_model: heModel,
          screen_width: width,
          screen_height: window.innerHeight,
        });
      }

      // Store device info in window for geo tracking to pick up
      window._lbsDeviceInfo = {
        device_type: deviceType, browser, os,
        device_brand: heBrand, device_model: heModel,
      };

      sessionStorage.setItem("lbs_device_tracked", "1");
    } catch (err) {
      console.log("📊 ANALYTICS: Device tracking skipped:", err.message);
    }
  }

  /* ─────────────────────────────────────────────
   * Visitor Location Tracking (Country & Nigerian State)
   * Uses ip-api.com (free, no key needed, 45 req/min)
   * ───────────────────────────────────────────── */
  async function trackVisitorLocation() {
      console.log("[trackVisitorLocation]");
    try {
      // Avoid duplicate tracking within the same session
      if (sessionStorage.getItem("lbs_geo_tracked")) return;

      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (!res.ok) return;

      const geo = await res.json();
      if (geo.error) return;

      const locationData = {
        ip: geo.ip || null,
        country: geo.country_name || "Unknown",
        country_code: geo.country_code || "",
        region: geo.region || "",
        city: geo.city || "",
      };

      // Send to GA4 as custom event
      if (window.gtag && GA_ID) {
        window.gtag("event", "visitor_location", {
          country: locationData.country,
          country_code: locationData.country_code,
          region: locationData.region,
          city: locationData.city,
          is_nigeria: locationData.country_code === "NG" ? "yes" : "no",
        });

        // If Nigerian visitor, also send state-level event
        if (locationData.country_code === "NG" && locationData.region) {
          window.gtag("event", "nigerian_visitor", {
            state: locationData.region,
            city: locationData.city,
          });
        }
      }

      // Store in Supabase site_visits table if available
      const c = window.DB?.client;
      if (c) {
        const dev = window._lbsDeviceInfo || {};
        const screenRes = `${screen.width}x${screen.height}`;
        const viewportSize = `${window.innerWidth}x${window.innerHeight}`;
        // Get current user ID if logged in (for fraud detection linking)
        let userId = null;
        try {
          const { data: { session } } = await c.auth.getSession();
          userId = session?.user?.id || null;
        } catch (_) { /* anonymous visitor */ }
        const { data } = await c.from("site_visits")
          .insert({
            ip_address: locationData.ip,
            country: locationData.country,
            country_code: locationData.country_code,
            region: locationData.region,
            city: locationData.city,
            page: window.location.pathname,
            referrer: document.referrer || null,
            device_type: dev.device_type || null,
            browser: dev.browser || null,
            os: dev.os || null,
            device_brand: dev.device_brand || null,
            device_model: dev.device_model || null,
            screen_resolution: screenRes,
            viewport_size: viewportSize,
            user_id: userId,
          })
          .select("id")
          .single();
        // Store visit ID so time-spent can update this row on unload
        if (data?.id) window._lbsVisitId = data.id;
      }

      sessionStorage.setItem("lbs_geo_tracked", "1");
      console.log(
        "📊 ANALYTICS: Visitor location tracked:",
        locationData.country,
        locationData.region,
      );
    } catch (err) {
      // Silently fail — geo tracking is non-critical
      console.log("📊 ANALYTICS: Geo tracking skipped:", err.message);
    }
  }

  /* ─────────────────────────────────────────────
   * Link visit to user after login
   * Called from auth state change so the visit row
   * gets the correct user_id even when tracking ran
   * before the user logged in.
   * ───────────────────────────────────────────── */
  async function linkVisitToUser() {
    console.log("[linkVisitToUser]");
    try {
      const visitId = window._lbsVisitId;
      const c = window.DB?.client;
      if (!visitId || !c) return;

      const { data: { session } } = await c.auth.getSession();
      if (!session?.user?.id) return;

      await c.from("site_visits")
        .update({ user_id: session.user.id })
        .eq("id", visitId)
        .is("user_id", null);

      console.log("📊 ANALYTICS: Visit linked to user", session.user.id);
    } catch (err) {
      console.log("📊 ANALYTICS: linkVisitToUser skipped:", err.message);
    }
  }

  /* ─────────────────────────────────────────────
   * Time Spent Tracking
   * Updates the site_visits row with duration on page unload
   * ───────────────────────────────────────────── */
  function trackTimeSpent() {
      console.log("[trackTimeSpent]");
    const startTime = Date.now();

    const updateDuration = () => {
      const visitId = window._lbsVisitId;
      const c = window.DB?.client;
      if (!visitId || !c) return;

      const seconds = Math.round((Date.now() - startTime) / 1000);
      if (seconds < 1) return;

      // Use sendBeacon-friendly approach via Supabase REST
      const cfg = window.APP_CONFIG || {};
      const supabaseUrl = cfg.SUPABASE_URL;
      const supabaseKey = cfg.SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const url = `${supabaseUrl}/rest/v1/site_visits?id=eq.${visitId}`;
        const body = JSON.stringify({ time_spent_seconds: seconds });
        fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "return=minimal",
          },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") updateDuration();
    });
    window.addEventListener("pagehide", updateDuration);
  }

  // Expose globally
  window.Analytics = Analytics;
  window.Analytics.linkVisitToUser = linkVisitToUser;

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
