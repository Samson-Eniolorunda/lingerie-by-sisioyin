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
  const signInBtn = $("#signInPromptBtn");
  const logoutBtn = $("#logoutBtn");
  const tabs = $$(".dash-tab[data-section]");
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
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.section === id));
    panels.forEach((p) =>
      p.classList.toggle("active", p.id === `section-${id}`),
    );
  }

  /* ── Order Rendering ─────────────────────── */
  function orderCard(o) {
    const id = o.id?.substring(0, 8) || "N/A";
    const status = o.status || "pending";
    const items = Array.isArray(o.items) ? o.items : [];
    const thumbs = items
      .slice(0, 4)
      .map((it) => {
        const img =
          it.image ||
          (Array.isArray(it.images) ? it.images[0] : "") ||
          "assets/img/placeholder.png";
        return `<img src="${img}" alt="${it.name || "Item"}" loading="lazy" />`;
      })
      .join("");
    const extra =
      items.length > 4
        ? `<span class="dash-order-more">+${items.length - 4}</span>`
        : "";

    return `
      <article class="dash-order-card">
        <div class="dash-order-top">
          <span class="dash-order-id">#${id}</span>
          <span class="dash-order-date">${fmtDate(o.created_at)}</span>
        </div>
        <div class="dash-order-thumbs">${thumbs}${extra}</div>
        <div class="dash-order-bottom">
          <span class="dash-order-total">${fmtPrice(o.total || 0)}</span>
          <span class="dash-order-status" data-status="${statusClass(status)}">${status}</span>
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
        <i class="fa-solid ${icon}"></i>
        <p>${msg}</p>
        ${shopLink ? '<a href="shop.html" class="dash-empty-btn">Start Shopping</a>' : ""}
      </div>`;
  }

  /* ── Data Loading ────────────────────────── */
  async function loadOrders() {
    const c = client();
    if (!c || !currentUser) return;
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
  }

  async function saveProfile(fd) {
    const c = client();
    if (!c || !currentUser) return;
    try {
      const { error } = await c.auth.updateUser({
        data: { full_name: fd.fullName, phone: fd.phone },
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
          <i class="fa-solid fa-map-marker-alt"></i>
          <p>No saved addresses</p>
          <button type="button" class="dash-empty-btn" id="addFirstAddressBtn">Add Address</button>
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

  function promptAddress() {
    // Build a small inline form inside a modal overlay
    const overlay = document.createElement("div");
    overlay.className = "dash-detail-overlay active";
    overlay.innerHTML = `
      <div class="dash-detail-modal">
        <div class="dash-detail-header">
          <h3>Add Address</h3>
          <button type="button" class="dash-detail-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="dash-detail-body">
          <form id="newAddressForm" style="display:flex;flex-direction:column;gap:var(--space-3);">
            <div class="dash-form-group">
              <label>Label <small>(optional)</small></label>
              <input type="text" id="addrLabel" placeholder="e.g. Home, Office" />
            </div>
            <div class="dash-form-group">
              <label>Street Address *</label>
              <input type="text" id="addrStreet" required placeholder="123 Main Street" />
            </div>
            <div class="dash-form-row">
              <div class="dash-form-group">
                <label>City *</label>
                <input type="text" id="addrCity" required placeholder="Lagos" />
              </div>
              <div class="dash-form-group">
                <label>State</label>
                <input type="text" id="addrState" placeholder="Lagos" />
              </div>
            </div>
            <div class="dash-form-group">
              <label>Phone <small>(optional)</small></label>
              <input type="tel" id="addrPhone" placeholder="+234..." />
            </div>
            <button type="submit" class="dash-save-btn" style="margin-top:var(--space-2);">
              <i class="fa-solid fa-plus"></i> Save Address
            </button>
          </form>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const closeModal = () => {
      overlay.classList.remove("active");
      document.body.style.overflow = "";
      setTimeout(() => overlay.remove(), 300);
    };

    overlay
      .querySelector(".dash-detail-close")
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
    gate.style.display = "none";
    shell.style.display = "block";

    const name =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
    if (elUserName) elUserName.textContent = name;
    if (elUserEmail) elUserEmail.textContent = user.email || "";
    if (elUserAvatar) elUserAvatar.textContent = (name[0] || "U").toUpperCase();

    loadProfile();
    loadOrders();
    loadWishlist();
    renderAddresses();
  }

  function hide() {
    currentUser = null;
    gate.style.display = "";
    shell.style.display = "none";
  }

  /* ── Order tracking timeline ───────────── */
  const TRACKING_STEPS = [
    { key: "pending", label: "Order Placed", icon: "fa-receipt" },
    { key: "confirmed", label: "Confirmed", icon: "fa-circle-check" },
    { key: "processing", label: "Processing", icon: "fa-boxes-stacked" },
    { key: "shipped", label: "Shipped", icon: "fa-truck-fast" },
    { key: "delivered", label: "Delivered", icon: "fa-box-open" },
  ];

  function buildTimeline(status) {
    if (status === "cancelled") {
      return `
        <div class="dash-timeline">
          <div class="dash-timeline-step cancelled">
            <div class="dash-timeline-icon"><i class="fa-solid fa-ban"></i></div>
            <div class="dash-timeline-label">Cancelled</div>
          </div>
        </div>`;
    }
    const idx = TRACKING_STEPS.findIndex((s) => s.key === status);
    return `
      <div class="dash-timeline">
        ${TRACKING_STEPS.map((step, i) => {
          const done = i <= idx;
          const active = i === idx;
          const cls = done ? (active ? "active" : "done") : "";
          return `
            <div class="dash-timeline-step ${cls}">
              <div class="dash-timeline-icon"><i class="fa-solid ${step.icon}"></i></div>
              <div class="dash-timeline-label">${step.label}</div>
            </div>`;
        }).join("")}
      </div>`;
  }

  /* ── Order detail modal ──────────────────── */
  function viewOrder(id) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const items = Array.isArray(o.items) ? o.items : [];
    const itemsHTML = items
      .map(
        (it) => `
        <div class="dash-detail-item">
          <img src="${it.image || (Array.isArray(it.images) ? it.images[0] : "") || "assets/img/placeholder.png"}" alt="" />
          <div>
            <strong>${it.name || "Item"}</strong>
            <span>Qty: ${it.quantity || 1} &middot; ${fmtPrice(it.price || 0)}</span>
          </div>
        </div>`,
      )
      .join("");

    const status = o.status || "pending";
    const timelineHTML = buildTimeline(status);
    const modal = document.createElement("div");
    modal.className = "dash-detail-overlay active";
    modal.innerHTML = `
      <div class="dash-detail-modal">
        <div class="dash-detail-header">
          <h3>Order #${o.id?.substring(0, 8)}</h3>
          <button type="button" class="dash-detail-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="dash-detail-body">
          <div class="dash-detail-meta">
            <span><i class="fa-regular fa-calendar"></i> ${fmtDate(o.created_at)}</span>
            <span class="dash-order-status" data-status="${statusClass(status)}">${status}</span>
          </div>
          ${timelineHTML}
          <div class="dash-detail-items">${itemsHTML}</div>
          <div class="dash-detail-summary">
            <div class="dash-detail-row"><span>Subtotal</span><span>${fmtPrice(o.subtotal || o.total || 0)}</span></div>
            <div class="dash-detail-row"><span>Shipping</span><span>${fmtPrice(o.shipping || 0)}</span></div>
            <div class="dash-detail-row total"><span>Total</span><span>${fmtPrice(o.total || 0)}</span></div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const close = () => {
      modal.classList.remove("active");
      document.body.style.overflow = "";
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector(".dash-detail-close").addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
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

    tabs.forEach((t) =>
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
    if (!c) return setTimeout(init, 500);

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
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 600));
  } else {
    setTimeout(init, 600);
  }
})();
