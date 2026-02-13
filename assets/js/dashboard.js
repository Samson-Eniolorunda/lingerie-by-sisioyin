/**
 * ============================================
 * DASHBOARD MODULE — Rebuilt
 * Lingerie by Sisioyin
 * ============================================
 */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  /* ── DOM refs ─────────────────────────────── */
  const gate = $("#authRequired");
  const shell = $("#dashboardLayout");
  const loading = $("#dashLoading");
  const signInBtn = $("#signInPromptBtn");
  const logoutBtn = $("#logoutBtn");
  const navItems = $$(".dash-tab[data-section]");
  const bbItems = $$(".dash-bb-item[data-section]");
  const panels = $$(".dash-panel");
  const profileForm = $("#profileForm");
  const orderFilter = $("#orderFilter");

  const elUserName = $("#userName");
  const elUserEmail = $("#userEmail");
  const elUserAvatar = $("#userAvatar");
  const elTotalOrders = $("#totalOrders");
  const elWishlist = $("#wishlistCount");
  const elTotalSpent = $("#totalSpent");
  const elRewardPoints = $("#rewardPoints");
  const elRecentOrders = $("#recentOrders");
  const elAllOrders = $("#allOrders");

  if (!gate || !shell) return; // not on dashboard page

  /* ── State ────────────────────────────────── */
  let currentUser = null;
  let orders = [];

  function client() {
    return window.DB?.client || null;
  }

  /* helper: hide loading skeleton */
  function hideLoading() {
    if (loading) loading.hidden = true;
  }

  /* ── Pre-check: hide loading & show shell instantly if we have a session token ── */
  (function preCheck() {
    try {
      // Scan for any Supabase auth token in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.currentSession || parsed?.access_token) {
              hideLoading();
              shell.hidden = false;
              return;
            }
          }
        }
      }
    } catch (_) {
      /* ignore */
    }
  })();

  /* ── Load Google Maps Places API if key is configured ── */
  (function loadGoogleMaps() {
    const key = window.APP_CONFIG?.GOOGLE_MAPS_API_KEY;
    if (!key || document.querySelector('script[src*="maps.googleapis.com"]'))
      return;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  })();

  /* ── Helpers ──────────────────────────────── */
  function fmtPrice(n) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(n);
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function statusClass(s) {
    const map = {
      confirmed: "green",
      delivered: "green",
      processing: "blue",
      shipped: "purple",
      pending: "amber",
      cancelled: "red",
    };
    return map[s] || "amber";
  }

  /* ── Tab Navigation ──────────────────────── */
  function switchTab(id) {
    navItems.forEach((t) =>
      t.classList.toggle("active", t.dataset.section === id),
    );
    bbItems.forEach((t) =>
      t.classList.toggle("active", t.dataset.section === id),
    );
    panels.forEach((p) =>
      p.classList.toggle("active", p.id === `section-${id}`),
    );
  }

  /* ── Order Rendering ─────────────────────── */
  function orderCard(o) {
    const id = o.id?.substring(0, 8) || "N/A";
    const status = o.status || "pending";
    const items = Array.isArray(o.items) ? o.items : [];
    const count = items.reduce((s, it) => s + (it.quantity || it.qty || 1), 0);
    const statusIcon = {
      delivered: "fa-box-open",
      shipped: "fa-truck-fast",
      processing: "fa-boxes-stacked",
      confirmed: "fa-circle-check",
      pending: "fa-receipt",
      cancelled: "fa-ban",
    };

    return `
      <article class="dash-order-card">
        <div class="dash-order-icon"><i class="fa-solid ${statusIcon[status] || "fa-receipt"}"></i></div>
        <div class="dash-order-info">
          <span class="dash-order-id">#${id}</span>
          <span class="dash-order-meta">${fmtDate(o.created_at)} · ${count} item${count !== 1 ? "s" : ""}</span>
        </div>
        <div class="dash-order-right">
          <span class="dash-order-price">${fmtPrice(o.total || 0)}</span>
          <span class="dash-order-status ${status}">${status}</span>
        </div>
      </article>`;
  }

  function renderOrders() {
    if (elTotalOrders) elTotalOrders.textContent = orders.length;

    // Total spent
    if (elTotalSpent) {
      const spent = orders
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + (o.total || 0), 0);
      elTotalSpent.textContent = fmtPrice(spent);
    }

    // Recent (overview)
    if (elRecentOrders) {
      const recent = orders.slice(0, 3);
      elRecentOrders.innerHTML = recent.length
        ? recent.map(orderCard).join("")
        : emptyHTML("fa-box-open", "No orders yet", true);
    }

    // All orders
    renderFilteredOrders();
  }

  function renderFilteredOrders() {
    if (!elAllOrders) return;
    const filter = orderFilter?.value || "all";
    const list =
      filter === "all"
        ? orders
        : orders.filter((o) => (o.status || "pending") === filter);

    elAllOrders.innerHTML = list.length
      ? list.map(orderCard).join("")
      : emptyHTML(
          "fa-box-open",
          filter === "all" ? "No orders yet" : `No ${filter} orders`,
          true,
        );
  }

  function emptyHTML(icon, msg, shopLink) {
    return `
      <div class="dash-empty">
        <div class="dash-empty-icon"><i class="fa-solid ${icon}"></i></div>
        <h3>${msg}</h3>
        <p>${shopLink ? "Browse our collection and place your first order." : ""}</p>
        ${shopLink ? '<a href="/shop" class="dash-btn-primary">Start Shopping</a>' : ""}
      </div>`;
  }

  /* ── Order/Address skeleton helpers ─── */
  function orderSkeleton(count) {
    count = count || 3;
    var html = "";
    for (var i = 0; i < count; i++) {
      html +=
        '<div class="dash-order-card dash-skel-pulse" style="pointer-events:none">' +
        '<div style="width:38px;height:38px;border-radius:10px;background:var(--bg-surface-alt)"></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:6px">' +
        '<div style="height:12px;width:50%;border-radius:6px;background:var(--bg-surface-alt)"></div>' +
        '<div style="height:10px;width:35%;border-radius:6px;background:var(--bg-surface-alt)"></div></div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">' +
        '<div style="height:12px;width:60px;border-radius:6px;background:var(--bg-surface-alt)"></div>' +
        '<div style="height:10px;width:40px;border-radius:6px;background:var(--bg-surface-alt)"></div></div></div>';
    }
    return html;
  }

  /* ── Data Loading ────────────────────────── */
  async function loadOrders() {
    const c = client();
    if (!c || !currentUser) return;
    // Show skeleton on both recent + all orders while loading
    if (elRecentOrders) elRecentOrders.innerHTML = orderSkeleton(3);
    if (elAllOrders) elAllOrders.innerHTML = orderSkeleton(4);
    try {
      const { data, error } = await c
        .from("orders")
        .select("*")
        .eq("customer_email", currentUser.email)
        .order("created_at", { ascending: false });
      if (error) throw error;
      orders = data || [];
      renderOrders();
    } catch (e) {
      console.error("DASH: order load error", e);
    }
  }

  function loadWishlist() {
    try {
      const w = JSON.parse(localStorage.getItem("LBS_WISHLIST") || "[]");
      if (elWishlist) elWishlist.textContent = w.length;
    } catch (_) {
      /* empty */
    }
  }

  /* ── Profile ─────────────────────────────── */
  function loadProfile() {
    if (!currentUser) return;
    const meta = currentUser.user_metadata || {};
    const full = meta.full_name || "";
    const parts = full.split(" ");
    const set = (id, v) => {
      const e = $(`#${id}`);
      if (e) e.value = v;
    };
    set("profileFirstName", parts[0] || "");
    set("profileLastName", parts.slice(1).join(" ") || "");
    set("profileEmail", currentUser.email || "");
    set("profilePhone", meta.phone || "");
    set("profileDob", meta.dob || "");
    set("profileGender", meta.gender || "");
  }

  async function saveProfile(fd) {
    const c = client();
    if (!c || !currentUser) return;
    try {
      const { error } = await c.auth.updateUser({
        data: {
          full_name: fd.fullName,
          phone: fd.phone,
          dob: fd.dob,
          gender: fd.gender,
        },
      });
      if (error) throw error;
      window.UTILS?.toast?.("Profile updated!", "success");
      if (elUserName)
        elUserName.textContent =
          fd.fullName || currentUser.email?.split("@")[0];
    } catch (e) {
      window.UTILS?.toast?.(e.message || "Update failed", "error");
    }
  }

  /* ── Auth State ──────────────────────────── */
  const ADDR_KEY = "LBS_ADDRESSES";

  function getAddresses() {
    try {
      return JSON.parse(localStorage.getItem(ADDR_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveAddresses(list) {
    localStorage.setItem(ADDR_KEY, JSON.stringify(list));
  }

  function renderAddresses() {
    const grid = $("#addressesGrid");
    if (!grid) return;
    const addrs = getAddresses();
    if (!addrs.length) {
      grid.innerHTML = `
        <div class="dash-empty">
          <div class="dash-empty-icon"><i class="fa-regular fa-map"></i></div>
          <h3>No saved addresses</h3>
          <p>Add a delivery address for faster checkout.</p>
          <button type="button" class="dash-empty-add" id="addFirstAddressBtn" title="Add Address"><i class="fa-solid fa-plus"></i></button>
        </div>`;
      // Re-bind the empty-state button
      $("#addFirstAddressBtn")?.addEventListener("click", promptAddress);
      return;
    }
    grid.innerHTML = addrs
      .map(
        (a, i) => `
        <div class="dash-addr-card">
          <div class="dash-addr-body">
            ${a.label ? `<strong class="dash-addr-label">${a.label}</strong>` : ""}
            <p>${a.street}</p>
            <p>${a.city}${a.state ? ", " + a.state : ""}</p>
            ${a.phone ? `<p><i class="fa-solid fa-phone"></i> ${a.phone}</p>` : ""}
          </div>
          <div class="dash-addr-actions">
            <button type="button" class="dash-addr-del" data-addr-del="${i}" title="Delete">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>`,
      )
      .join("");
  }

  /* ── Nigerian address suggestions ── */
  const NG_CITIES = [
    "Lagos",
    "Ikeja",
    "Lekki",
    "Victoria Island",
    "Surulere",
    "Yaba",
    "Ajah",
    "Ikoyi",
    "Mushin",
    "Agege",
    "Oshodi",
    "Apapa",
    "Badagry",
    "Epe",
    "Ikorodu",
    "Abuja",
    "Garki",
    "Wuse",
    "Maitama",
    "Asokoro",
    "Gwarinpa",
    "Jabi",
    "Kubwa",
    "Port Harcourt",
    "Ibadan",
    "Benin City",
    "Kano",
    "Kaduna",
    "Enugu",
    "Aba",
    "Uyo",
    "Calabar",
    "Warri",
    "Abeokuta",
    "Owerri",
    "Jos",
    "Ilorin",
    "Akure",
    "Ado-Ekiti",
    "Asaba",
    "Umuahia",
    "Onitsha",
    "Nsukka",
    "Nnewi",
  ];

  const NG_STATES = [
    "Lagos",
    "FCT",
    "Rivers",
    "Oyo",
    "Edo",
    "Kano",
    "Kaduna",
    "Enugu",
    "Abia",
    "Akwa Ibom",
    "Cross River",
    "Delta",
    "Ogun",
    "Imo",
    "Plateau",
    "Kwara",
    "Ondo",
    "Ekiti",
    "Anambra",
    "Ebonyi",
  ];

  function attachSuggestions(input, suggestions) {
    let listEl = null;
    input.addEventListener("input", () => {
      const val = input.value.trim().toLowerCase();
      if (listEl) listEl.remove();
      if (!val || val.length < 2) return;
      const matches = suggestions
        .filter((s) => s.toLowerCase().includes(val))
        .slice(0, 6);
      if (!matches.length) return;
      listEl = document.createElement("ul");
      listEl.className = "addr-suggestions";
      matches.forEach((m) => {
        const li = document.createElement("li");
        li.textContent = m;
        li.addEventListener("click", () => {
          input.value = m;
          listEl.remove();
          listEl = null;
          input.dispatchEvent(new Event("change"));
        });
        listEl.appendChild(li);
      });
      input.parentElement.style.position = "relative";
      input.parentElement.appendChild(listEl);
    });
    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (listEl) {
          listEl.remove();
          listEl = null;
        }
      }, 200);
    });
  }

  function promptAddress() {
    const overlay = document.createElement("div");
    overlay.className = "dash-modal-overlay active";
    overlay.innerHTML = `
      <div class="dash-modal addr-modal">
        <div class="addr-modal-header">
          <div class="addr-modal-icon"><i class="fa-solid fa-map-location-dot"></i></div>
          <h3>Add New Address</h3>
          <p>Enter your delivery address details below</p>
          <button type="button" class="addr-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="addr-modal-body">
          <form id="newAddressForm">
            <div class="addr-field">
              <label><i class="fa-solid fa-tag"></i> Label <small>(optional)</small></label>
              <div class="addr-input-wrap">
                <input type="text" id="addrLabel" placeholder="e.g. Home, Office, Mom's house" />
              </div>
            </div>
            <div class="addr-field">
              <label><i class="fa-solid fa-location-dot"></i> Street Address *</label>
              <div class="addr-input-wrap">
                <input type="text" id="addrStreet" required placeholder="123 Main Street, Lekki Phase 1" autocomplete="street-address" />
              </div>
            </div>
            <div class="addr-row">
              <div class="addr-field">
                <label><i class="fa-solid fa-city"></i> City *</label>
                <div class="addr-input-wrap">
                  <input type="text" id="addrCity" required placeholder="e.g. Ikeja" autocomplete="address-level2" />
                </div>
              </div>
              <div class="addr-field">
                <label><i class="fa-solid fa-map"></i> State</label>
                <div class="addr-input-wrap">
                  <input type="text" id="addrState" placeholder="e.g. Lagos" autocomplete="address-level1" />
                </div>
              </div>
            </div>
            <div class="addr-field">
              <label><i class="fa-solid fa-phone"></i> Phone <small>(optional)</small></label>
              <div class="addr-input-wrap">
                <input type="tel" id="addrPhone" placeholder="+234 800 000 0000" autocomplete="tel" />
              </div>
            </div>
            <button type="submit" class="addr-save-btn">
              <i class="fa-solid fa-check"></i> Save Address
            </button>
          </form>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    // Attach city & state suggestions
    attachSuggestions(overlay.querySelector("#addrCity"), NG_CITIES);
    attachSuggestions(overlay.querySelector("#addrState"), NG_STATES);

    // Google Places Autocomplete for street address (if API loaded)
    try {
      if (window.google?.maps?.places) {
        const streetInput = overlay.querySelector("#addrStreet");
        const autocomplete = new google.maps.places.Autocomplete(streetInput, {
          componentRestrictions: { country: "ng" },
          fields: ["address_components", "formatted_address"],
          types: ["address"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.address_components) return;

          let streetNumber = "",
            route = "",
            neighborhood = "",
            sublocality = "",
            city = "",
            state = "";
          place.address_components.forEach((c) => {
            const t = c.types;
            if (t.includes("street_number")) streetNumber = c.long_name;
            if (t.includes("route")) route = c.long_name;
            if (t.includes("neighborhood")) neighborhood = c.long_name;
            if (t.includes("sublocality_level_1") || t.includes("sublocality"))
              sublocality = c.long_name;
            if (t.includes("locality")) city = c.long_name;
            if (t.includes("administrative_area_level_2") && !city)
              city = c.long_name;
            if (t.includes("administrative_area_level_1")) state = c.long_name;
          });

          // Build street: number + route, fallback to neighborhood/sublocality
          let street = "";
          if (route) {
            street = streetNumber ? `${streetNumber} ${route}` : route;
          }
          if (neighborhood && !street.includes(neighborhood)) {
            street = street ? `${street}, ${neighborhood}` : neighborhood;
          }
          if (sublocality && !street.includes(sublocality)) {
            street = street ? `${street}, ${sublocality}` : sublocality;
          }

          if (street) streetInput.value = street;
          if (city) overlay.querySelector("#addrCity").value = city;
          if (state) overlay.querySelector("#addrState").value = state;
        });
      }
    } catch (_) {
      /* Google Places not available */
    }

    const closeModal = () => {
      overlay.classList.remove("active");
      document.body.style.overflow = "";
      setTimeout(() => overlay.remove(), 300);
    };

    overlay
      .querySelector(".addr-modal-close")
      .addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    overlay.querySelector("#newAddressForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const street = overlay.querySelector("#addrStreet").value.trim();
      const city = overlay.querySelector("#addrCity").value.trim();
      if (!street || !city) {
        window.UTILS?.toast?.("Street and City are required", "error");
        return;
      }
      const addrs = getAddresses();
      addrs.push({
        label: overlay.querySelector("#addrLabel").value.trim(),
        street,
        city,
        state: overlay.querySelector("#addrState").value.trim(),
        phone: overlay.querySelector("#addrPhone").value.trim(),
      });
      saveAddresses(addrs);
      window.UTILS?.toast?.("Address saved!", "success");
      closeModal();
      renderAddresses();
    });
  }

  function deleteAddress(index) {
    if (!confirm("Delete this address?")) return;
    const addrs = getAddresses();
    addrs.splice(index, 1);
    saveAddresses(addrs);
    window.UTILS?.toast?.("Address removed", "success");
    renderAddresses();
  }

  function show(user) {
    currentUser = user;
    // Show a brief login spinner before revealing the dashboard
    if (loading && !loading.hidden) {
      loading.innerHTML =
        '<div class="dash-login-spinner"><div class="dash-login-spinner-ring"></div><p>Setting up your dashboard…</p></div>';
      setTimeout(function () {
        hideLoading();
        gate.hidden = true;
        shell.hidden = false;
        finishShow(user);
      }, 600);
    } else {
      hideLoading();
      gate.hidden = true;
      shell.hidden = false;
      finishShow(user);
    }
  }

  function finishShow(user) {
    const name =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
    if (elUserName) elUserName.textContent = name;
    if (elUserEmail) elUserEmail.textContent = user.email || "";
    // Avatar: first + last initial
    const parts = name.trim().split(/\s+/);
    const initials =
      parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (name[0] || "U").toUpperCase();
    if (elUserAvatar) elUserAvatar.textContent = initials;

    loadProfile();
    loadOrders();
    loadWishlist();
    renderAddresses();
    initSettings();
    updateGreeting(name);
  }

  function hide() {
    currentUser = null;
    hideLoading();
    gate.hidden = false;
    shell.hidden = true;
  }

  /* ── Greeting ────────────────────────── */
  function updateGreeting(name) {
    const el = $("#dashGreeting");
    if (!el) return;
    const h = new Date().getHours();
    const tod = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    el.textContent = `Good ${tod}, ${name.split(" ")[0]}! Here's your account at a glance.`;
  }

  /* ── Settings ─────────────────────────── */
  const SETTINGS_KEY = "LBS_DASH_SETTINGS";

  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }
  function saveSettings(obj) {
    const merged = { ...getSettings(), ...obj };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  }

  function initSettings() {
    const prefs = getSettings();

    /* ─── 1. Appearance — Theme dropdown ─── */
    const themeSelect = $("#dashThemeSelect");
    if (themeSelect) {
      const saved = localStorage.getItem("theme") || "system";
      themeSelect.value = saved;
      themeSelect.addEventListener("change", () => {
        const theme = themeSelect.value;
        if (theme === "system") {
          localStorage.removeItem("theme");
          const sys = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
          document.documentElement.setAttribute("data-theme", sys);
        } else {
          localStorage.setItem("theme", theme);
          document.documentElement.setAttribute("data-theme", theme);
        }
        saveSettings({ theme });
      });
    }

    /* ─── 1b. Appearance — Text size picker ─── */
    const sizePicker = $("#dashSizePicker");
    if (sizePicker) {
      const currentSize = prefs.textSize || "medium";
      const sizeMap = { small: "14px", medium: "16px", large: "18px" };
      document.documentElement.style.fontSize = sizeMap[currentSize] || "16px";
      sizePicker.querySelectorAll(".dash-size-opt").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.size === currentSize);
        btn.addEventListener("click", () => {
          const size = btn.dataset.size;
          sizePicker
            .querySelectorAll(".dash-size-opt")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          document.documentElement.style.fontSize = sizeMap[size] || "16px";
          saveSettings({ textSize: size });
        });
      });
    }

    /* ─── 2. Notification toggles ─── */
    const notifMap = {
      notifOrders: { key: "notifOrders", defaultOn: true },
      notifShipping: { key: "notifShipping", defaultOn: true },
      notifPromos: { key: "notifPromos", defaultOn: false },
      notifPriceDrop: { key: "notifPriceDrop", defaultOn: false },
      notifNewArrivals: { key: "notifNewArrivals", defaultOn: false },
    };
    Object.entries(notifMap).forEach(([id, { key, defaultOn }]) => {
      const el = $(`#${id}`);
      if (!el) return;
      el.checked = prefs[key] !== undefined ? prefs[key] : defaultOn;
      el.addEventListener("change", () => saveSettings({ [key]: el.checked }));
    });

    /* ─── 3. Communication toggles ─── */
    const commMap = {
      commEmail: { key: "commEmail", defaultOn: true },
      commSMS: { key: "commSMS", defaultOn: false },
    };
    Object.entries(commMap).forEach(([id, { key, defaultOn }]) => {
      const el = $(`#${id}`);
      if (!el) return;
      el.checked = prefs[key] !== undefined ? prefs[key] : defaultOn;
      el.addEventListener("change", () => saveSettings({ [key]: el.checked }));
    });

    /* ─── 3b. WhatsApp opt-in (persisted to Supabase) ─── */
    const waToggle = $("#commWhatsApp");
    const waRow = $("#whatsappNumberRow");
    const waInput = $("#whatsappNumber");
    const waSaveBtn = $("#saveWhatsappBtn");
    const waStatus = $("#whatsappStatus");

    async function loadWhatsAppPrefs() {
      const c = client();
      if (!c || !currentUser) return;
      try {
        const { data } = await c
          .from("profiles")
          .select("whatsapp_opted_in, whatsapp_number")
          .eq("id", currentUser.id)
          .single();
        if (data) {
          if (waToggle) waToggle.checked = !!data.whatsapp_opted_in;
          if (waInput) waInput.value = data.whatsapp_number || "";
          if (waRow) waRow.style.display = data.whatsapp_opted_in ? "block" : "none";
        }
      } catch (_) { /* columns may not exist yet */ }
    }

    function showWaStatus(msg, type) {
      if (!waStatus) return;
      waStatus.textContent = msg;
      waStatus.className = "dash-whatsapp-status " + type;
      if (type === "success") setTimeout(() => { waStatus.textContent = ""; }, 3000);
    }

    if (waToggle) {
      waToggle.addEventListener("change", async () => {
        const on = waToggle.checked;
        saveSettings({ commWhatsApp: on });
        if (waRow) waRow.style.display = on ? "block" : "none";
        const c = client();
        if (!c || !currentUser) return;
        try {
          await c.from("profiles").update({ whatsapp_opted_in: on }).eq("id", currentUser.id);
          if (!on) {
            showWaStatus("WhatsApp updates disabled.", "success");
          }
        } catch (_) { /* ignore if col missing */ }
      });
    }

    if (waSaveBtn) {
      waSaveBtn.addEventListener("click", async () => {
        const num = (waInput?.value || "").trim();
        if (!num) { showWaStatus("Please enter a valid WhatsApp number.", "error"); return; }
        // Basic validation: must start with + and have at least 10 digits
        const cleaned = num.replace(/[\s\-()]/g, "");
        if (!/^\+\d{10,15}$/.test(cleaned)) {
          showWaStatus("Enter a valid number with country code, e.g. +2348012345678", "error");
          return;
        }
        const c = client();
        if (!c || !currentUser) return;
        waSaveBtn.disabled = true;
        waSaveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          const { error } = await c
            .from("profiles")
            .update({ whatsapp_number: cleaned, whatsapp_opted_in: true })
            .eq("id", currentUser.id);
          if (error) throw error;
          showWaStatus("WhatsApp number saved! You'll receive order updates.", "success");
        } catch (e) {
          showWaStatus(e.message || "Failed to save number.", "error");
        } finally {
          waSaveBtn.disabled = false;
          waSaveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save';
        }
      });
    }

    // Load WhatsApp prefs from DB when settings are initialized
    loadWhatsAppPrefs();

    /* ─── 4. Privacy & Data ─── */
    const privacyMap = {
      privacyRecs: { key: "privacyRecs", defaultOn: true },
      privacyMarketing: { key: "privacyMarketing", defaultOn: false },
    };
    Object.entries(privacyMap).forEach(([id, { key, defaultOn }]) => {
      const el = $(`#${id}`);
      if (!el) return;
      el.checked = prefs[key] !== undefined ? prefs[key] : defaultOn;
      el.addEventListener("change", () => saveSettings({ [key]: el.checked }));
    });

    // Clear browsing history
    $("#clearHistoryBtn")?.addEventListener("click", () => {
      const keys = Object.keys(localStorage).filter(
        (k) =>
          k.startsWith("LBS_RECENT") ||
          k.startsWith("LBS_SEARCH") ||
          k.startsWith("LBS_BROWSE"),
      );
      keys.forEach((k) => localStorage.removeItem(k));
      window.UTILS?.toast?.("Browsing history cleared", "success");
    });

    /* ─── 5. Security ─── */
    // Change password
    $("#changePasswordBtn")?.addEventListener("click", async () => {
      const c = client();
      if (!c || !currentUser?.email) return;
      const btn = $("#changePasswordBtn");
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
      try {
        const { error } = await c.auth.resetPasswordForEmail(
          currentUser.email,
          {
            redirectTo: window.location.origin + "/dashboard",
          },
        );
        if (error) throw error;
        window.UTILS?.toast?.(
          "Password reset email sent! Check your inbox.",
          "success",
        );
      } catch (e) {
        window.UTILS?.toast?.(
          e.message || "Failed to send reset email",
          "error",
        );
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });

    /* ─── 6. Account Management ─── */
    // Download my data — as a readable text file
    $("#downloadDataBtn")?.addEventListener("click", async () => {
      const btn = $("#downloadDataBtn");
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing…';
      try {
        const profile = currentUser?.user_metadata || {};
        const email = currentUser?.email || "";
        const settings = getSettings();
        const addresses = JSON.parse(
          localStorage.getItem("LBS_ADDRESSES") || "[]",
        );
        const date = new Date().toLocaleDateString("en-NG", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        let txt = "╔══════════════════════════════════════════╗\n";
        txt += "║    LINGERIE BY SISIOYIN — MY DATA        ║\n";
        txt += "╚══════════════════════════════════════════╝\n\n";
        txt += "Exported: " + date + "\n\n";

        txt += "── PROFILE ──────────────────────────────\n";
        txt += "Name:    " + (profile.full_name || "N/A") + "\n";
        txt += "Email:   " + email + "\n";
        txt += "Phone:   " + (profile.phone || "N/A") + "\n";
        txt += "DOB:     " + (profile.dob || "N/A") + "\n";
        txt += "Gender:  " + (profile.gender || "N/A") + "\n\n";

        txt += "── SETTINGS ─────────────────────────────\n";
        Object.entries(settings).forEach(function (pair) {
          txt += pair[0] + ": " + pair[1] + "\n";
        });
        txt += "\n";

        txt += "── SAVED ADDRESSES (" + addresses.length + ") ──────────────\n";
        addresses.forEach(function (a, i) {
          txt += "\n  Address " + (i + 1) + ":\n";
          txt += "    Label:   " + (a.label || "N/A") + "\n";
          txt += "    Street:  " + (a.street || "N/A") + "\n";
          txt += "    City:    " + (a.city || "N/A") + "\n";
          txt += "    State:   " + (a.state || "N/A") + "\n";
          txt += "    Phone:   " + (a.phone || "N/A") + "\n";
        });
        txt += "\n";

        txt += "── ORDERS (" + orders.length + ") ───────────────────────\n";
        orders.forEach(function (o) {
          txt +=
            "\n  Order #" + (o.order_number || o.id?.substring(0, 8)) + "\n";
          txt += "    Status:  " + (o.status || "pending") + "\n";
          txt += "    Date:    " + fmtDate(o.created_at) + "\n";
          txt += "    Total:   " + fmtPrice(o.total || 0) + "\n";
          var items = Array.isArray(o.items) ? o.items : [];
          items.forEach(function (it) {
            txt +=
              "    - " +
              (it.name || "Item") +
              " x" +
              (it.quantity || it.qty || 1) +
              "\n";
          });
        });

        txt += "\n── END OF DATA ──────────────────────────\n";

        var blob = new Blob([txt], { type: "text/plain" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download =
          "LBS_MyData_" + new Date().toISOString().slice(0, 10) + ".txt";
        a.click();
        URL.revokeObjectURL(url);
        window.UTILS?.toast?.("Data downloaded successfully", "success");
      } catch (e) {
        window.UTILS?.toast?.("Failed to export data", "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });

    // Deactivate account
    $("#deactivateBtn")?.addEventListener("click", async () => {
      const ok = confirm(
        "Are you sure you want to deactivate your account?\n\nYour account will be disabled but your data will be preserved. You can reactivate by signing in again.",
      );
      if (!ok) return;
      const c = client();
      if (!c) return;
      try {
        await c.auth.updateUser({
          data: { deactivated: true, deactivated_at: new Date().toISOString() },
        });
        window.UTILS?.toast?.(
          "Account deactivated. You can reactivate by signing in.",
          "info",
        );
        if (window.AUTH?.logout) {
          await window.AUTH.logout();
          hide();
        }
      } catch (e) {
        window.UTILS?.toast?.(
          e.message || "Failed to deactivate account",
          "error",
        );
      }
    });

    /* ─── 7. Danger Zone ─── */
    // Sign out (second button in settings)
    $("#logoutBtn2")?.addEventListener("click", async () => {
      if (window.AUTH?.logout) {
        await window.AUTH.logout();
        hide();
      }
    });

    // Delete account
    $("#deleteAccountBtn")?.addEventListener("click", async () => {
      const ok = confirm(
        "⚠️ DELETE ACCOUNT PERMANENTLY\n\nThis will permanently delete your account and all associated data. This action CANNOT be undone.\n\nAre you absolutely sure?",
      );
      if (!ok) return;
      const doubleConfirm = prompt(
        'Type "DELETE" to confirm permanent account deletion:',
      );
      if (doubleConfirm !== "DELETE") {
        window.UTILS?.toast?.("Account deletion cancelled", "info");
        return;
      }
      const c = client();
      if (!c) return;
      const btn = $("#deleteAccountBtn");
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting…';
      try {
        // Mark account for deletion in metadata
        await c.auth.updateUser({
          data: {
            deletion_requested: true,
            deletion_requested_at: new Date().toISOString(),
          },
        });
        // Clear all local data
        Object.keys(localStorage)
          .filter((k) => k.startsWith("LBS_"))
          .forEach((k) => localStorage.removeItem(k));
        window.UTILS?.toast?.(
          "Account deletion requested. You will receive a confirmation email.",
          "success",
        );
        setTimeout(async () => {
          if (window.AUTH?.logout) {
            await window.AUTH.logout();
            hide();
          }
          window.location.href = "/home";
        }, 2000);
      } catch (e) {
        window.UTILS?.toast?.(e.message || "Failed to delete account", "error");
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });
  }

  /* ── Live Order Tracking UI ──────────── */
  const TRACKING_STEPS = [
    {
      key: "pending",
      label: "Order Placed",
      icon: "fa-receipt",
      desc: "Your order has been received",
    },
    {
      key: "confirmed",
      label: "Confirmed",
      icon: "fa-circle-check",
      desc: "Order confirmed by seller",
    },
    {
      key: "processing",
      label: "Processing",
      icon: "fa-boxes-stacked",
      desc: "Your items are being prepared",
    },
    {
      key: "shipped",
      label: "Shipped",
      icon: "fa-truck-fast",
      desc: "On the way to you",
    },
    {
      key: "delivered",
      label: "Delivered",
      icon: "fa-box-open",
      desc: "Delivered successfully",
    },
  ];

  function buildTimeline(status, order) {
    if (status === "cancelled") {
      return `
        <div class="track-timeline">
          <div class="track-step cancelled">
            <div class="track-step-dot"><i class="fa-solid fa-ban"></i></div>
            <div class="track-step-content">
              <span class="track-step-label">Order Cancelled</span>
              <span class="track-step-desc">This order has been cancelled</span>
            </div>
          </div>
        </div>`;
    }

    const idx = TRACKING_STEPS.findIndex((s) => s.key === status);
    const orderDate = order?.created_at ? new Date(order.created_at) : null;

    return `
      <div class="track-timeline">
        ${TRACKING_STEPS.map((step, i) => {
          const done = i <= idx;
          const active = i === idx;
          // Delivered step should show as "done" (green), not "active" (pink)
          const cls = done
            ? active && step.key !== "delivered"
              ? "active"
              : "done"
            : "upcoming";
          let timeStr = "";
          if (i === 0 && orderDate) {
            timeStr = fmtDate(order.created_at);
          } else if (done && orderDate) {
            const est = new Date(orderDate.getTime() + i * 24 * 3600 * 1000);
            timeStr = fmtDate(est.toISOString());
          }
          return `
            <div class="track-step ${cls}">
              <div class="track-step-indicator">
                <div class="track-step-dot"><i class="fa-solid ${done ? "fa-check" : step.icon}"></i></div>
                ${i < TRACKING_STEPS.length - 1 ? '<div class="track-step-line"></div>' : ""}
              </div>
              <div class="track-step-content">
                <span class="track-step-label">${step.label}</span>
                <span class="track-step-desc">${step.desc}</span>
                ${timeStr ? `<span class="track-step-time">${timeStr}</span>` : ""}
              </div>
            </div>`;
        }).join("")}
      </div>
      ${idx >= 0 && idx < 4 ? `<div class="track-eta"><i class="fa-solid fa-clock"></i> Estimated delivery: ${fmtDate(new Date(orderDate.getTime() + 4 * 24 * 3600 * 1000).toISOString())}</div>` : ""}`;
  }

  /* ── Order detail modal — Live Tracking UI ── */
  function viewOrder(id) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const items = Array.isArray(o.items) ? o.items : [];
    const status = o.status || "pending";
    const orderNum = o.order_number || `#${o.id?.substring(0, 8)}`;

    const itemsHTML = items
      .map(
        (it) => `
        <div class="track-item">
          <img src="${it.image || (Array.isArray(it.images) ? it.images[0] : "") || "assets/img/placeholder.png"}" alt="" loading="lazy" />
          <div class="track-item-info">
            <span class="track-item-name">${it.name || "Item"}</span>
            <span class="track-item-meta">${it.selectedSize || it.size || "One Size"}${it.selectedColor ? " · " + it.selectedColor : ""} × ${it.quantity || it.qty || 1}</span>
          </div>
          <span class="track-item-price">${fmtPrice(it.price || it.price_ngn || 0)}</span>
        </div>`,
      )
      .join("");

    const timelineHTML = buildTimeline(status, o);
    const modal = document.createElement("div");
    modal.className = "track-overlay active";
    modal.innerHTML = `
      <div class="track-modal">
        <div class="track-header">
          <div class="track-header-info">
            <h3>Order ${orderNum}</h3>
            <span class="track-date">${fmtDate(o.created_at)}</span>
          </div>
          <button type="button" class="track-close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="track-status-badge" data-status="${status}">
          <i class="fa-solid ${status === "cancelled" ? "fa-ban" : status === "delivered" ? "fa-check-circle" : "fa-circle-dot"}"></i>
          <span>${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>

        <div class="track-body">
          ${timelineHTML}

          <div class="track-section">
            <h4><i class="fa-solid fa-boxes-stacked"></i> Items</h4>
            <div class="track-items">${itemsHTML}</div>
          </div>

          <div class="track-summary">
            <div class="track-summary-row"><span>Subtotal</span><span>${fmtPrice(o.subtotal || o.total || 0)}</span></div>
            <div class="track-summary-row"><span>Shipping</span><span>${fmtPrice(o.shipping_cost || o.shipping || 0)}</span></div>
            <div class="track-summary-row total"><span>Total</span><span>${fmtPrice(o.total || 0)}</span></div>
          </div>

          ${
            status === "delivered"
              ? `
          <div class="track-section track-review-section">
            <h4><i class="fa-solid fa-star"></i> Review Your Purchase</h4>
            <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-3);">Share your experience with the products you received.</p>
            ${items
              .map(
                (it) => `
              <button type="button" class="track-review-btn" data-review-product="${it.id || ""}" data-review-name="${(it.name || "Item").replace(/"/g, "&quot;")}">
                <i class="fa-solid fa-pen"></i> Review "${it.name || "Item"}"
              </button>
            `,
              )
              .join("")}
          </div>`
              : ""
          }
        </div>
      </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const close = () => {
      modal.classList.remove("active");
      document.body.style.overflow = "";
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector(".track-close").addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    // Handle review button clicks for delivered orders
    modal.querySelectorAll(".track-review-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const productId = btn.dataset.reviewProduct;
        if (productId) {
          close();
          // Navigate to shop with product modal
          window.location.href = `/shop?product=${productId}`;
        }
      });
    });
  }

  /* ── Event Listeners ─────────────────────── */
  function bind() {
    signInBtn?.addEventListener("click", () => {
      if (window.AUTH?.openModal) return window.AUTH.openModal("login");
      const btn = document.getElementById("loginBtn");
      if (btn) return btn.click();
    });

    logoutBtn?.addEventListener("click", async () => {
      if (window.AUTH?.logout) {
        await window.AUTH.logout();
        hide();
      }
    });

    navItems.forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.section)),
    );
    bbItems.forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.section)),
    );

    $$("[data-go]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        switchTab(el.dataset.go);
      }),
    );

    orderFilter?.addEventListener("change", renderFilteredOrders);

    profileForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = profileForm.querySelector('button[type="submit"]');
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
      await saveProfile({
        fullName:
          `${$("#profileFirstName")?.value || ""} ${$("#profileLastName")?.value || ""}`.trim(),
        phone: $("#profilePhone")?.value || "",
        dob: $("#profileDob")?.value || "",
        gender: $("#profileGender")?.value || "",
      });
      btn.disabled = false;
      btn.innerHTML = orig;
    });

    document.addEventListener("click", (e) => {
      // Order card click
      const card = e.target.closest(".dash-order-card");
      if (card) {
        const idEl = card.querySelector(".dash-order-id");
        if (!idEl) return;
        const shortId = idEl.textContent.replace("#", "");
        const order = orders.find((o) => o.id?.startsWith(shortId));
        if (order) viewOrder(order.id);
        return;
      }
      // Address delete click
      const delBtn = e.target.closest("[data-addr-del]");
      if (delBtn) {
        deleteAddress(parseInt(delBtn.dataset.addrDel, 10));
        return;
      }
    });

    // Address add buttons
    $("#addAddressBtn")?.addEventListener("click", promptAddress);
    $("#addFirstAddressBtn")?.addEventListener("click", promptAddress);

    window.addEventListener("auth:changed", (e) => {
      const u = e.detail?.user;
      u ? show(u) : hide();
    });
  }

  /* ── Init ─────────────────────────────────── */
  async function init() {
    bind();
    const c = client();
    if (!c) return setTimeout(init, 200);

    try {
      const {
        data: { session },
      } = await c.auth.getSession();
      session?.user ? show(session.user) : hide();
    } catch (_) {
      hide();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }
})();
