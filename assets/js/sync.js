/**
 * ============================================
 * SYNC MODULE
 * Lingeries by Sisioyin - Cross-Device Sync
 * ============================================
 *
 * Syncs wishlist, cart, saved addresses, and dashboard settings
 * between localStorage and Supabase profiles table.
 *
 * Strategy:
 *   - On login:  pull from DB, merge with local, save merged to both
 *   - On change: save to localStorage immediately + debounced push to DB
 *   - On logout: local data stays on device (user expects this)
 */
(function () {
  "use strict";

  console.log("🔄 SYNC: Module initializing");

  /* ─────────────────────────────────────────────
   * Constants
   * ───────────────────────────────────────────── */
  const KEYS = {
    wishlist: "LBS_WISHLIST",
    cart: "LBS_CART_V1",
    saved_addresses: "LBS_ADDRESSES",
    dashboard_settings: "LBS_DASH_SETTINGS",
  };

  // Columns in the profiles table
  const SYNC_FIELDS = ["wishlist", "cart", "saved_addresses", "dashboard_settings"];

  // Debounce timers per field
  const _timers = {};
  const DEBOUNCE_MS = 1500;

  /* ─────────────────────────────────────────────
   * Helpers
   * ───────────────────────────────────────────── */
  function getClient() {
    return window.DB?.client || null;
  }

  function getUserId() {
    const user = window.AUTH?.getUser?.();
    return user?.id || null;
  }

  function loadLocal(field) {
    try {
      const raw = localStorage.getItem(KEYS[field]);
      return raw ? JSON.parse(raw) : (field === "dashboard_settings" ? {} : []);
    } catch (_) {
      return field === "dashboard_settings" ? {} : [];
    }
  }

  function saveLocal(field, data) {
    try {
      localStorage.setItem(KEYS[field], JSON.stringify(data));
    } catch (e) {
      console.warn("🔄 SYNC: Failed to save locally:", e);
    }
  }

  /* ─────────────────────────────────────────────
   * Merge Strategies
   * ───────────────────────────────────────────── */

  /**
   * Merge wishlist: union of product IDs (no duplicates)
   */
  function mergeWishlist(local, remote) {
    const set = new Set([...(local || []), ...(remote || [])]);
    return [...set];
  }

  /**
   * Merge cart: prefer local (most recent user action),
   * but add remote items not present locally
   */
  function mergeCart(local, remote) {
    if (!remote?.length) return local || [];
    if (!local?.length) return remote;
    const localIds = new Set(local.map((i) => i.variantId));
    const merged = [...local];
    for (const item of remote) {
      if (!localIds.has(item.variantId)) {
        merged.push(item);
      }
    }
    return merged;
  }

  /**
   * Merge addresses: union by street+city key (no duplicates)
   */
  function mergeAddresses(local, remote) {
    if (!remote?.length) return local || [];
    if (!local?.length) return remote;
    const key = (a) => `${(a.street || "").toLowerCase().trim()}|${(a.city || "").toLowerCase().trim()}`;
    const seen = new Set(local.map(key));
    const merged = [...local];
    for (const addr of remote) {
      if (!seen.has(key(addr))) {
        merged.push(addr);
        seen.add(key(addr));
      }
    }
    return merged;
  }

  /**
   * Merge dashboard settings: shallow merge, local wins
   */
  function mergeSettings(local, remote) {
    return { ...(remote || {}), ...(local || {}) };
  }

  const MERGE_FN = {
    wishlist: mergeWishlist,
    cart: mergeCart,
    saved_addresses: mergeAddresses,
    dashboard_settings: mergeSettings,
  };

  /* ─────────────────────────────────────────────
   * Push to Supabase (debounced)
   * ───────────────────────────────────────────── */
  async function pushField(field) {
    const uid = getUserId();
    const client = getClient();
    if (!uid || !client) return;

    const data = loadLocal(field);
    try {
      const { error } = await client
        .from("profiles")
        .update({ [field]: data })
        .eq("id", uid);

      if (error) {
        console.warn(`🔄 SYNC: Push failed for ${field}:`, error.message);
      } else {
        console.log(`🔄 SYNC: Pushed ${field} to DB`);
      }
    } catch (e) {
      console.warn(`🔄 SYNC: Push exception for ${field}:`, e);
    }
  }

  function debouncedPush(field) {
    if (_timers[field]) clearTimeout(_timers[field]);
    _timers[field] = setTimeout(() => pushField(field), DEBOUNCE_MS);
  }

  /* ─────────────────────────────────────────────
   * Pull from Supabase + Merge (on login)
   * ───────────────────────────────────────────── */
  async function pullAndMerge() {
    const uid = getUserId();
    const client = getClient();
    if (!uid || !client) return;

    console.log("🔄 SYNC: Pulling data from DB...");
    try {
      const { data: profile, error } = await client
        .from("profiles")
        .select(SYNC_FIELDS.join(","))
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.warn("🔄 SYNC: Pull failed:", error.message);
        return;
      }
      if (!profile) return;

      // Merge each field
      const updates = {};
      for (const field of SYNC_FIELDS) {
        const local = loadLocal(field);
        const remote = profile[field];
        const merged = MERGE_FN[field](local, remote);

        // Save merged to localStorage
        saveLocal(field, merged);
        updates[field] = merged;
      }

      // Push merged data back to DB
      const { error: updateError } = await client
        .from("profiles")
        .update(updates)
        .eq("id", uid);

      if (updateError) {
        console.warn("🔄 SYNC: Merge push failed:", updateError.message);
      } else {
        console.log("🔄 SYNC: Pull & merge complete");
      }

      // Notify UI components to re-render
      window.dispatchEvent(new CustomEvent("sync:complete"));
      window.dispatchEvent(new CustomEvent("wishlist:changed"));
      window.dispatchEvent(new CustomEvent("cart:updated"));

    } catch (e) {
      console.warn("🔄 SYNC: Pull exception:", e);
    }
  }

  /* ─────────────────────────────────────────────
   * Public API
   * ───────────────────────────────────────────── */
  window.SYNC = {
    /**
     * Call on login — pulls DB data and merges with local
     */
    onLogin: pullAndMerge,

    /**
     * Call whenever wishlist changes
     */
    pushWishlist() {
      debouncedPush("wishlist");
    },

    /**
     * Call whenever cart changes
     */
    pushCart() {
      debouncedPush("cart");
    },

    /**
     * Call whenever addresses change
     */
    pushAddresses() {
      debouncedPush("saved_addresses");
    },

    /**
     * Call whenever dashboard settings change
     */
    pushSettings() {
      debouncedPush("dashboard_settings");
    },

    /**
     * Force push all fields now (e.g. before navigating away)
     */
    async pushAll() {
      for (const field of SYNC_FIELDS) {
        await pushField(field);
      }
    },
  };

  console.log("✅ SYNC: Module initialized");
})();
