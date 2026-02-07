/**
 * ============================================
 * TRACK ORDER MODULE
 * Lingerie by Sisioyin - Public Order Tracking
 * ============================================
 */
(function () {
  "use strict";

  const form = document.getElementById("trackForm");
  const input = document.getElementById("trackInput");
  const btn = document.getElementById("trackBtn");
  const result = document.getElementById("trackResult");
  if (!form) return;

  function client() {
    return window.DB?.client || null;
  }

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

  const STEPS = [
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
      desc: "Confirmed by seller",
    },
    {
      key: "processing",
      label: "Processing",
      icon: "fa-boxes-stacked",
      desc: "Items being prepared",
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

  function buildTimeline(status, createdAt) {
    if (status === "cancelled") {
      return `<div class="track-timeline"><div class="track-step cancelled"><div class="track-step-indicator"><div class="track-step-dot"><i class="fa-solid fa-ban"></i></div></div><div class="track-step-content"><span class="track-step-label">Order Cancelled</span><span class="track-step-desc">This order has been cancelled</span></div></div></div>`;
    }

    const idx = STEPS.findIndex((s) => s.key === status);
    const orderDate = createdAt ? new Date(createdAt) : null;

    return `<div class="track-timeline">${STEPS.map((step, i) => {
      const done = i <= idx;
      const active = i === idx;
      const cls = done
        ? active && step.key !== "delivered"
          ? "active"
          : "done"
        : "upcoming";
      let timeStr = "";
      if (i === 0 && orderDate) timeStr = fmtDate(createdAt);
      else if (done && orderDate) {
        const est = new Date(orderDate.getTime() + i * 24 * 3600 * 1000);
        timeStr = fmtDate(est.toISOString());
      }
      return `<div class="track-step ${cls}"><div class="track-step-indicator"><div class="track-step-dot"><i class="fa-solid ${done ? "fa-check" : step.icon}"></i></div>${i < STEPS.length - 1 ? '<div class="track-step-line"></div>' : ""}</div><div class="track-step-content"><span class="track-step-label">${step.label}</span><span class="track-step-desc">${step.desc}</span>${timeStr ? `<span class="track-step-time">${timeStr}</span>` : ""}</div></div>`;
    }).join("")}</div>`;
  }

  function renderOrder(order) {
    const status = order.status || "pending";
    const orderNum = order.order_number || `#${order.id.substring(0, 8)}`;
    const items = Array.isArray(order.items) ? order.items : [];

    result.innerHTML = `
      <div class="track-result">
        <div class="track-modal" style="max-width:100%;box-shadow:none;border:1px solid var(--border-light);">
          <div class="track-header">
            <div class="track-header-info">
              <h3>Order ${orderNum}</h3>
              <span class="track-date">${fmtDate(order.created_at)}</span>
            </div>
          </div>
          <div class="track-status-badge" data-status="${status}">
            <i class="fa-solid ${status === "cancelled" ? "fa-ban" : status === "delivered" ? "fa-check-circle" : "fa-circle-dot"}"></i>
            <span>${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
          <div class="track-body">
            ${buildTimeline(status, order.created_at)}
            <div class="track-section">
              <h4><i class="fa-solid fa-boxes-stacked"></i> ${items.length} Item${items.length !== 1 ? "s" : ""}</h4>
              <div class="track-items">
                ${items
                  .map(
                    (it) => `
                  <div class="track-item">
                    <img src="${it.image || (Array.isArray(it.images) ? it.images[0] : "") || "assets/img/placeholder.png"}" alt="" loading="lazy" />
                    <div class="track-item-info">
                      <span class="track-item-name">${it.name || "Item"}</span>
                      <span class="track-item-meta">${it.selectedSize || it.size || "One Size"} × ${it.quantity || it.qty || 1}</span>
                    </div>
                    <span class="track-item-price">${fmtPrice(it.price || it.price_ngn || 0)}</span>
                  </div>`,
                  )
                  .join("")}
              </div>
            </div>
            <div class="track-summary">
              <div class="track-summary-row"><span>Total</span><span>${fmtPrice(order.total || 0)}</span></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderNotFound(query) {
    result.innerHTML = `
      <div class="track-not-found">
        <i class="fa-solid fa-box-open"></i>
        <p>No order found for "<strong>${query}</strong>"</p>
        <p style="font-size:13px;margin-top:8px;">Double-check your order number and try again.</p>
      </div>`;
  }

  async function trackOrder(query) {
    const c = client();
    if (!c) {
      window.UTILS?.toast?.("Service unavailable. Please try later.", "error");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';
    result.innerHTML = "";

    try {
      let data = null;
      let error = null;

      // Try by order_number first
      if (query.toUpperCase().startsWith("LBS")) {
        const res = await c
          .from("orders")
          .select(
            "id, order_number, status, created_at, items, total, shipping_cost, subtotal",
          )
          .eq("order_number", query.toUpperCase())
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      // Try by UUID prefix
      if (!data && !query.toUpperCase().startsWith("LBS")) {
        const res = await c
          .from("orders")
          .select(
            "id, order_number, status, created_at, items, total, shipping_cost, subtotal",
          )
          .ilike("id", `${query}%`)
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (error) throw error;

      if (data) {
        renderOrder(data);
      } else {
        renderNotFound(query);
      }
    } catch (e) {
      console.error("TRACK: Error:", e);
      renderNotFound(query);
    } finally {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa-solid fa-magnifying-glass"></i> Track Order';
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) trackOrder(q);
  });

  // Check URL params
  const params = new URLSearchParams(window.location.search);
  const orderParam = params.get("order") || params.get("id");
  if (orderParam) {
    input.value = orderParam;
    setTimeout(() => trackOrder(orderParam), 800);
  }
})();
