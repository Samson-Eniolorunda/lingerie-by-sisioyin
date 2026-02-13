/* ==========================================================================
  ADMIN JS (CLEAN)
  - Theme (system default)
  - Auth + Admin gate (RPC is_admin)
  - Role-based access (super_admin / editor / developer)
  - Soft delete for products
  - Activity logging
  - Inventory render + viewer slider (with swipe)
  - Studio form + studio slider (with swipe)
  - Add/Edit mode positioning (Save/Delete)
========================================================================== */
(function () {
  "use strict";

  const supabase = window.DB?.client;
  if (!supabase) {
    console.error("Supabase client missing. Check config.js/supabase.js.");
    return;
  }

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const on = (el, evt, fn) => el && el.addEventListener(evt, fn);

  /* ── Pre-check: hide auth/show admin instantly if we have a session token ── */
  (function preCheck() {
    try {
      const stored = localStorage.getItem("sb-oriojylsilcsvcsefuux-auth-token");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.currentSession || parsed?.access_token) {
          const authView = document.querySelector("[data-auth-view]");
          const adminView = document.querySelector("[data-admin-view]");
          if (authView) authView.hidden = true;
          if (adminView) adminView.hidden = false;
        }
      }
    } catch (_) {
      /* ignore */
    }
  })();

  // Escape HTML to prevent XSS
  const escapeHtml = (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const AUTH_REDIRECT_URL = window.location.origin + window.location.pathname;

  /* =========================
    Current user state
  ========================= */
  let currentUserRole = null; // "super_admin" | "editor" | "developer" | null
  let currentUserId = null;

  /* =========================
    Pagination state
  ========================= */
  const ITEMS_PER_PAGE = 12;
  let currentPage = 1;
  let totalPages = 1;

  /* =========================
    Bulk selection state
  ========================= */
  let selectedProducts = new Set();
  let bulkMode = false;

  /* =========================
    Undo state
  ========================= */
  let undoAction = null;
  let undoTimeout = null;
  const UNDO_DURATION = 5000;

  /* =========================
    Session timeout state
  ========================= */
  let sessionTimeoutId = null;
  let sessionWarningId = null;
  let sessionCountdownId = null;
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const SESSION_WARNING = 60 * 1000; // Show warning 60 seconds before

  /* =========================
    Theme (system)
  ========================= */
  const THEME_KEY = "theme_pref"; // "system" | "light" | "dark"
  const mediaDark = window.matchMedia?.("(prefers-color-scheme: dark)");

  function getThemePref() {
    const pref = localStorage.getItem(THEME_KEY) || "system";
    console.log("[getThemePref] Theme preference:", pref);
    return pref;
  }

  function setThemePref(pref) {
    console.log("[setThemePref] Setting theme to:", pref);
    localStorage.setItem(THEME_KEY, pref);
    applyTheme();
    updateThemeToggleUI();
    updateSidebarThemeToggleUI();
  }

  function updateThemeToggleUI() {
    const pref = getThemePref();
    $$("[data-theme-btn]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeBtn === pref);
    });
  }

  function getEffectiveTheme() {
    const pref = getThemePref();
    if (pref === "light" || pref === "dark") {
      console.log("[getEffectiveTheme] Using explicit preference:", pref);
      return pref;
    }
    const systemTheme = mediaDark?.matches ? "dark" : "light";
    console.log("[getEffectiveTheme] Using system theme:", systemTheme);
    return systemTheme;
  }

  function applyTheme() {
    console.log("[applyTheme] Applying theme");
    const effective = getEffectiveTheme();
    console.log("[applyTheme] Effective theme:", effective);
    document.documentElement.dataset.theme = effective;
    document.documentElement.classList.toggle("dark", effective === "dark");

    const meta = document.querySelector("meta[name='color-scheme']");
    if (meta)
      meta.setAttribute(
        "content",
        effective === "dark" ? "dark light" : "light dark",
      );
  }

  function bindThemeSystemSync() {
    console.log("[bindThemeSystemSync] Initializing theme sync");
    applyTheme();
    if (!mediaDark) {
      console.log("[bindThemeSystemSync] No mediaDark support");
      return;
    }

    const handler = () => {
      console.log("[bindThemeSystemSync] System theme changed");
      if (getThemePref() === "system") applyTheme();
    };

    if (typeof mediaDark.addEventListener === "function")
      mediaDark.addEventListener("change", handler);
    else if (typeof mediaDark.addListener === "function")
      mediaDark.addListener(handler);
  }

  function bindThemeToggle() {
    console.log("[bindThemeToggle] Binding theme toggle buttons");
    $$("[data-theme-btn]").forEach((btn) => {
      on(btn, "click", () => {
        setThemePref(btn.dataset.themeBtn);
      });
    });
    updateThemeToggleUI();

    // Sidebar theme toggle (checkbox slider for mobile)
    const themeCheckbox = $("#themeCheckbox");
    if (themeCheckbox) {
      on(themeCheckbox, "change", () => {
        setThemePref(themeCheckbox.checked ? "dark" : "light");
      });
      updateSidebarThemeToggleUI();
    }
  }

  function updateSidebarThemeToggleUI() {
    const themeCheckbox = $("#themeCheckbox");
    if (!themeCheckbox) return;

    const isDark = getEffectiveTheme() === "dark";
    themeCheckbox.checked = isDark;
  }

  /* =========================
    Confirmation Modal
  ========================= */
  let confirmResolve = null;

  function showConfirmModal(options = {}) {
    console.log("[showConfirmModal] Showing confirmation:", options);
    return new Promise((resolve) => {
      confirmResolve = resolve;

      const modal = $("#confirmModal");
      const iconWrapper = $("#confirmIcon");
      const title = $("#confirmTitle");
      const message = $("#confirmMessage");
      const okBtn = $("#confirmOkBtn");
      const cancelBtn = $("#confirmCancelBtn");

      if (!modal) {
        resolve(window.confirm(options.message || "Are you sure?"));
        return;
      }

      // Set content
      title.textContent = options.title || "Confirm Action";
      message.textContent =
        options.message || "Are you sure you want to proceed?";

      // Set icon type
      const iconType = options.type || "danger";
      const iconClass = {
        danger: "fa-trash",
        warning: "fa-triangle-exclamation",
        info: "fa-circle-info",
      }[iconType];
      iconWrapper.innerHTML = `<div class="confirm-icon ${iconType}"><i class="fa-solid ${iconClass}"></i></div>`;

      // Set button styles based on type
      if (iconType === "danger") {
        okBtn.className = "confirm-btn danger";
        okBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${options.confirmText || "Delete"}`;
      } else {
        okBtn.className = "confirm-btn primary";
        okBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${options.confirmText || "Confirm"}`;
      }

      modal.removeAttribute("hidden");
      modal.classList.add("active");
    });
  }

  function closeConfirmModal(result = false) {
    console.log("[closeConfirmModal] Closing with result:", result);
    const modal = $("#confirmModal");
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("hidden", "");
    }
    if (confirmResolve) {
      confirmResolve(result);
      confirmResolve = null;
    }
  }

  function bindConfirmModal() {
    console.log("[bindConfirmModal] Binding confirmation modal");
    on($("#confirmCancelBtn"), "click", () => closeConfirmModal(false));
    on($("#confirmOkBtn"), "click", () => closeConfirmModal(true));
    on($("#confirmCloseX"), "click", () => closeConfirmModal(false));
    on($("#confirmModal"), "click", (e) => {
      if (e.target.id === "confirmModal") closeConfirmModal(false);
    });
  }

  /* =========================
    Undo Toast
  ========================= */
  function showUndoToast(message, undoCallback) {
    console.log("[showUndoToast] Showing undo:", message);
    const toast = $("#undoToast");
    const msg = $("#undoMsg");
    const timerBar = $("#undoTimerBar");

    if (!toast) return;

    // Clear previous
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      undoTimeout = null;
    }

    msg.textContent = message;
    undoAction = undoCallback;

    // Animate timer bar
    timerBar.style.transition = "none";
    timerBar.style.width = "100%";
    requestAnimationFrame(() => {
      timerBar.style.transition = `width ${UNDO_DURATION}ms linear`;
      timerBar.style.width = "0%";
    });

    toast.classList.add("active");

    undoTimeout = setTimeout(() => {
      hideUndoToast();
      undoAction = null;
    }, UNDO_DURATION);
  }

  function hideUndoToast() {
    const toast = $("#undoToast");
    if (toast) toast.classList.remove("active");
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      undoTimeout = null;
    }
  }

  function bindUndoToast() {
    console.log("[bindUndoToast] Binding undo toast");
    on($("#undoBtn"), "click", async () => {
      console.log("[undoBtn] Undo clicked");
      if (undoAction) {
        await undoAction();
        undoAction = null;
      }
      hideUndoToast();
    });
  }

  /* =========================
    Skeleton Loading
  ========================= */
  function getSkeletonCard() {
    return `
      <div class="skeleton-card">
        <div class="skeleton-img skeleton"></div>
        <div class="skeleton-content">
          <div class="skeleton-title skeleton"></div>
          <div class="skeleton-price skeleton"></div>
          <div class="skeleton-stock skeleton"></div>
        </div>
      </div>
    `;
  }

  function getSkeletonRow() {
    return `
      <div class="skeleton-row">
        <div class="skeleton-avatar skeleton"></div>
        <div style="flex: 1;">
          <div class="skeleton-text w-60 skeleton" style="margin-bottom: 8px;"></div>
          <div class="skeleton-text w-40 skeleton"></div>
        </div>
      </div>
    `;
  }

  function showSkeletonGrid(container, count = 8) {
    if (!container) return;
    container.innerHTML = Array(count).fill(getSkeletonCard()).join("");
  }

  function showSkeletonList(container, count = 5) {
    if (!container) return;
    container.innerHTML = Array(count).fill(getSkeletonRow()).join("");
  }

  /* =========================
    Image Compression
  ========================= */
  async function compressImage(file, maxWidth = 1200, quality = 0.8) {
    console.log("[compressImage] Compressing:", file.name, "size:", file.size);

    return new Promise((resolve) => {
      // Skip if not an image or already small
      if (!file.type.startsWith("image/") || file.size < 100000) {
        resolve(file);
        return;
      }

      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale down if needed
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              console.log(
                "[compressImage] Compressed:",
                blob.size,
                "bytes (was",
                file.size,
                ")",
              );
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  /* =========================
    Session Timeout
  ========================= */
  function resetSessionTimer() {
    console.log("[resetSessionTimer] Resetting session timer");

    if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
    if (sessionWarningId) clearTimeout(sessionWarningId);
    if (sessionCountdownId) clearInterval(sessionCountdownId);

    hideSessionModal();

    // Set warning timer
    sessionWarningId = setTimeout(() => {
      showSessionWarning();
    }, SESSION_TIMEOUT - SESSION_WARNING);

    // Set timeout timer
    sessionTimeoutId = setTimeout(() => {
      handleSessionTimeout();
    }, SESSION_TIMEOUT);
  }

  function showSessionWarning() {
    console.log("[showSessionWarning] Showing session warning");
    const modal = $("#sessionModal");
    const countdown = $("#sessionCountdown");

    if (!modal) return;
    modal.hidden = false;

    let seconds = Math.floor(SESSION_WARNING / 1000);
    countdown.textContent = seconds;

    sessionCountdownId = setInterval(() => {
      seconds--;
      countdown.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(sessionCountdownId);
      }
    }, 1000);
  }

  function hideSessionModal() {
    const modal = $("#sessionModal");
    if (modal) modal.hidden = true;
    if (sessionCountdownId) {
      clearInterval(sessionCountdownId);
      sessionCountdownId = null;
    }
  }

  async function handleSessionTimeout() {
    console.log("[handleSessionTimeout] Session timed out");
    hideSessionModal();
    await supabase.auth.signOut();
    window.location.reload();
  }

  function bindSessionTimeout() {
    console.log("[bindSessionTimeout] Binding session timeout handlers");

    // Activity events that reset timer
    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((evt) => {
      document.addEventListener(
        evt,
        () => {
          if (!$("#sessionModal")?.hidden === false) return; // Don't reset if warning is shown
          resetSessionTimer();
        },
        { passive: true },
      );
    });

    // Session modal buttons
    on($("#sessionExtendBtn"), "click", () => {
      console.log("[sessionExtendBtn] Extending session");
      resetSessionTimer();
    });

    on($("#sessionLogoutBtn"), "click", async () => {
      console.log("[sessionLogoutBtn] Logging out");
      hideSessionModal();
      await supabase.auth.signOut();
      window.location.reload();
    });
  }

  /* =========================
    Keyboard Shortcuts
  ========================= */
  function bindKeyboardShortcuts() {
    console.log("[bindKeyboardShortcuts] Binding keyboard shortcuts");

    document.addEventListener("keydown", (e) => {
      // Ctrl+S or Cmd+S to save product
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        const studioView = $("#viewStudio");
        if (studioView && studioView.classList.contains("active")) {
          e.preventDefault();
          console.log("[keyboard] Ctrl+S pressed, submitting form");
          const form = $("#productForm");
          if (form) form.requestSubmit();
        }
      }

      // Escape to close modals (already handled in bindNav, but adding here for completeness)
      if (e.key === "Escape") {
        closeConfirmModal(false);
        hideUndoToast();
        hideSessionModal();
      }
    });
  }

  /* =========================
    CSV Export
  ========================= */
  function exportToCSV(data, filename = "export.csv") {
    console.log("[exportToCSV] Exporting", data.length, "items");

    if (!data.length) {
      showToast("No data to export");
      return;
    }

    // Get headers from first item
    const headers = Object.keys(data[0]);

    // Build CSV content
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            let cell = row[header];
            if (cell === null || cell === undefined) cell = "";
            if (Array.isArray(cell)) cell = cell.join("; ");
            if (typeof cell === "object") cell = JSON.stringify(cell);
            // Escape quotes and wrap in quotes if contains comma
            cell = String(cell).replace(/"/g, '""');
            if (
              cell.includes(",") ||
              cell.includes('"') ||
              cell.includes("\n")
            ) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(","),
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
    showToast(`Exported ${data.length} items`);
  }

  function exportProducts() {
    console.log("[exportProducts] Exporting products");
    const exportData = productsCache.map((p) => ({
      name: p.name || "",
      category: p.category || "",
      price_ngn: p.price_ngn || 0,
      qty: p.qty || 0,
      gender: p.gender || "",
      sizes: (p.sizes || []).join(", "),
      colors: (p.colors || []).join(", "),
      is_active: p.is_active ? "Yes" : "No",
      is_new: p.is_new ? "Yes" : "No",
      created_at: p.created_at || "",
    }));

    const date = new Date().toISOString().split("T")[0];
    exportToCSV(exportData, `products_${date}.csv`);
  }

  async function exportOrders() {
    console.log("[exportOrders] Exporting orders");
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const exportData = (data || []).map((o) => ({
        order_number: o.order_number || "",
        customer_name: o.customer_name || "",
        customer_email: o.customer_email || "",
        customer_phone: o.customer_phone || "",
        status: o.status || "",
        total: o.total || 0,
        subtotal: o.subtotal || 0,
        shipping_cost: o.shipping_cost || 0,
        payment_method: o.payment_method || "",
        delivery_state: o.delivery_state || "",
        items_count: Array.isArray(o.items) ? o.items.length : 0,
        created_at: o.created_at || "",
      }));
      const date = new Date().toISOString().split("T")[0];
      exportToCSV(exportData, `orders_${date}.csv`);
    } catch (err) {
      showToast("Failed to export orders");
      console.error("[exportOrders]", err);
    }
  }

  async function exportCustomers() {
    console.log("[exportCustomers] Exporting customers");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, phone, is_admin, created_at")
        .eq("is_admin", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const exportData = (data || []).map((p) => ({
        name: p.display_name || "",
        email: p.email || "",
        phone: p.phone || "",
        created_at: p.created_at || "",
      }));
      const date = new Date().toISOString().split("T")[0];
      exportToCSV(exportData, `customers_${date}.csv`);
    } catch (err) {
      showToast("Failed to export customers");
      console.error("[exportCustomers]", err);
    }
  }

  async function exportReviews() {
    console.log("[exportReviews] Exporting reviews");
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const exportData = (data || []).map((r) => ({
        product_id: r.product_id || "",
        reviewer_name: r.reviewer_name || "",
        reviewer_email: r.reviewer_email || "",
        rating: r.rating || 0,
        title: r.title || "",
        comment: r.comment || "",
        is_approved: r.is_approved ? "Yes" : "No",
        created_at: r.created_at || "",
      }));
      const date = new Date().toISOString().split("T")[0];
      exportToCSV(exportData, `reviews_${date}.csv`);
    } catch (err) {
      showToast("Failed to export reviews");
      console.error("[exportReviews]", err);
    }
  }

  async function exportActivityLogs() {
    console.log("[exportActivityLogs] Exporting activity logs");
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const exportData = (data || []).map((l) => ({
        action: l.action || "",
        entity_type: l.entity_type || "",
        entity_id: l.entity_id || "",
        admin_id: l.admin_id || "",
        details: JSON.stringify(l.details || {}),
        created_at: l.created_at || "",
      }));
      const date = new Date().toISOString().split("T")[0];
      exportToCSV(exportData, `activity_logs_${date}.csv`);
    } catch (err) {
      showToast("Failed to export activity logs");
      console.error("[exportActivityLogs]", err);
    }
  }

  function bindExport() {
    console.log("[bindExport] Binding export button");
    const btn = $("#exportBtn");
    const menu = $("#exportMenu");
    if (!btn || !menu) return;

    // Toggle dropdown
    on(btn, "click", (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });

    // Close on outside click
    document.addEventListener("click", () => {
      menu.hidden = true;
    });

    // Handle export options
    on(menu, "click", async (e) => {
      const opt = e.target.closest("[data-export]");
      if (!opt) return;
      menu.hidden = true;
      const type = opt.dataset.export;
      switch (type) {
        case "products":
          exportProducts();
          break;
        case "orders":
          await exportOrders();
          break;
        case "customers":
          await exportCustomers();
          break;
        case "reviews":
          await exportReviews();
          break;
        case "activity":
          await exportActivityLogs();
          break;
      }
    });
  }

  /* =========================
    Toast + helpers
  ========================= */
  function showToast(msg) {
    console.log("[showToast]", msg);
    const el = $("#toast");
    if (!el) return alert(msg);
    const t = el.querySelector(".toast-msg");
    if (t) t.textContent = msg;
    el.hidden = false;
    setTimeout(() => (el.hidden = true), 3000);
  }

  function explainError(err) {
    console.log("[explainError] Processing error:", err);
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    return (
      err.message || err.details || err.hint || err.code || "Unknown error"
    );
  }

  // Keeps icons intact (uses innerHTML, not textContent)
  function setBtnLoading(btn, isLoading, loadingHTML) {
    console.log("[setBtnLoading] Setting loading state:", isLoading);
    if (!btn) return;
    if (!btn.dataset.normalHtml) btn.dataset.normalHtml = btn.innerHTML;
    btn.disabled = !!isLoading;
    btn.innerHTML = isLoading
      ? loadingHTML || "Working..."
      : btn.dataset.normalHtml;
  }

  /* =========================
    Swipe helper (studio + viewer)
  ========================= */
  function bindSwipeArea(el, onPrev, onNext) {
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let isDown = false;

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      isDown = true;
      startX = e.clientX;
      startY = e.clientY;
      el.setPointerCapture?.(e.pointerId);
    });

    el.addEventListener("pointerup", (e) => {
      if (!isDown) return;
      isDown = false;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) onNext();
        else onPrev();
      }
    });

    el.addEventListener("pointercancel", () => {
      isDown = false;
    });
  }

  /* =========================
    Auth banner
  ========================= */
  function clearAuthMsg() {
    console.log("[clearAuthMsg] Clearing auth message");
    const box = $("#authMsg");
    const txt = $("#authMsgText");
    if (txt) txt.textContent = "";
    if (box) box.hidden = true;
  }

  function setAuthMsg(message) {
    console.log("[setAuthMsg]", message);
    const box = $("#authMsg");
    const txt = $("#authMsgText");
    const msg = message || "Something went wrong.";
    if (txt) txt.textContent = msg;
    if (box) box.hidden = false;
    if (!box) alert(msg);
  }

  /* =========================
    Auth view switching
  ========================= */
  function showAuthView(name) {
    console.log("[showAuthView] Showing:", name);
    clearAuthMsg();
    $$("[data-auth-view-name]").forEach((v) => (v.hidden = true));
    const target = $(`[data-auth-view-name='${name}']`);
    if (target) target.hidden = false;

    const switcher = $("#authSwitch");
    if (switcher) switcher.hidden = !(name === "login" || name === "signup");

    $$(".auth-tab").forEach((t) => t.classList.remove("active"));
    const tab = $(`[data-auth-tab='${name}']`);
    if (tab) tab.classList.add("active");

    // Hide email confirmation if showing other view
    const confirmView = $("#emailConfirmationView");
    if (confirmView && name !== "confirm") confirmView.hidden = true;
  }

  function showEmailConfirmationView(email) {
    console.log("[showEmailConfirmationView] Showing confirmation for:", email);

    // Hide all auth forms
    $$("[data-auth-view-name]").forEach((v) => (v.hidden = true));
    const switcher = $("#authSwitch");
    if (switcher) switcher.hidden = true;

    // Show or create the confirmation view
    let confirmView = $("#emailConfirmationView");
    if (!confirmView) {
      confirmView = document.createElement("div");
      confirmView.id = "emailConfirmationView";
      confirmView.className = "email-confirmation-view";
      confirmView.innerHTML = `
        <div class="confirmation-icon">
          <i class="fa-solid fa-envelope-circle-check"></i>
        </div>
        <h2>Check Your Email</h2>
        <p class="confirmation-email"></p>
        <p class="confirmation-text">
          We've sent a confirmation link to your email address. 
          Click the link to verify your account and access the dashboard.
        </p>
        <div class="confirmation-loading">
          <div class="spinner"></div>
          <span>Waiting for confirmation...</span>
        </div>
        <button type="button" class="btn btn-outline btn-block" id="backToLoginBtn">
          <i class="fa-solid fa-arrow-left"></i>
          Back to Login
        </button>
      `;
      const authPanel = $(".auth-panel");
      if (authPanel) authPanel.appendChild(confirmView);

      // Bind back button
      on($("#backToLoginBtn"), "click", () => {
        confirmView.hidden = true;
        showAuthView("login");
      });
    }

    // Update email display
    const emailEl = confirmView.querySelector(".confirmation-email");
    if (emailEl) emailEl.textContent = email;

    confirmView.hidden = false;
  }

  /* =========================
    Password toggle
  ========================= */
  function bindPasswordToggles() {
    console.log("[bindPasswordToggles] Binding password toggle buttons");
    $$("[data-toggle-password]").forEach((btn) => {
      on(btn, "click", () => {
        // Find the sibling input within the same .input-icon container
        const container = btn.closest(".input-icon");
        const input = container
          ? container.querySelector(
              "input[type='password'], input[type='text']",
            )
          : null;
        if (!input) return;

        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        btn.classList.toggle("is-on", reveal);

        const icon = btn.querySelector("i");
        if (icon) {
          icon.classList.remove("fa-eye", "fa-eye-slash");
          icon.classList.add(reveal ? "fa-eye-slash" : "fa-eye");
        }
      });
    });
  }

  /* =========================
    Admin gate (RPC)
  ========================= */
  async function isAdminRPC() {
    console.log("[isAdminRPC] Checking admin status via RPC");
    const { data, error } = await supabase.rpc("is_admin");
    if (error) {
      console.error("[isAdminRPC] Error:", error);
      return { ok: false, reason: explainError(error) };
    }
    console.log("[isAdminRPC] Result:", data);
    return { ok: true, value: !!data };
  }

  async function fetchUserRole(userId) {
    console.log("[fetchUserRole] Fetching role for user:", userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (error) {
      console.warn("[fetchUserRole] Error:", error);
      return "editor"; // fallback
    }
    console.log("[fetchUserRole] Role found:", data?.role);
    return data?.role || "editor";
  }

  function applyRoleBasedUI() {
    console.log("[applyRoleBasedUI] Applying UI for role:", currentUserRole);
    const inviteBtn = $("#openInviteModalBtn");
    const activityNav = $('[data-view-target="activity"]');
    const adminsNav = $('[data-view-target="admins"]');
    const trashNav = $('[data-view-target="trash"]');
    const statusText = $("#adminStatusText");

    const isSuperAdmin = currentUserRole === "super_admin";
    const isDeveloper = currentUserRole === "developer";
    const isEditor = currentUserRole === "editor";
    // Developer has same privileges as super_admin
    const hasFullAccess = isSuperAdmin || isDeveloper;

    console.log(
      "[applyRoleBasedUI] isSuperAdmin:",
      isSuperAdmin,
      "isDeveloper:",
      isDeveloper,
      "isEditor:",
      isEditor,
    );

    // Update status text with role badge
    if (statusText && statusText.textContent) {
      const currentText = statusText.textContent;
      if (isSuperAdmin && !currentText.includes("Super Admin")) {
        statusText.innerHTML = `${currentText} <span style="color: var(--primary); font-weight: 800; white-space: nowrap;">• Super Admin</span>`;
      } else if (isDeveloper && !currentText.includes("Developer")) {
        statusText.innerHTML = `${currentText} <span style="color: #10b981; font-weight: 800; white-space: nowrap;">• Developer</span>`;
      } else if (isEditor && !currentText.includes("Editor")) {
        statusText.innerHTML = `${currentText} <span style="color: var(--text-muted); font-weight: 800; white-space: nowrap;">• Editor</span>`;
      }
    }

    // Super_admin and developer can invite other admins
    if (inviteBtn) {
      inviteBtn.style.display = hasFullAccess ? "" : "none";
    }

    // Super_admin and developer can see activity logs
    if (activityNav) {
      activityNav.style.display = hasFullAccess ? "" : "none";
    }

    // Super_admin and developer can manage admins
    if (adminsNav) {
      adminsNav.style.display = hasFullAccess ? "" : "none";
    }

    // Super_admin and developer can see trash
    if (trashNav) {
      trashNav.style.display = hasFullAccess ? "" : "none";
    }
  }

  function getSessionDisplayName(session) {
    console.log("[getSessionDisplayName] Getting display name");
    const u = session?.user;
    if (!u) return "Welcome back";

    const meta = u.user_metadata || {};
    const first = String(meta.first_name || "").trim();
    const last = String(meta.last_name || "").trim();
    const full = `${first} ${last}`.trim();
    const displayName = full || u.email || "Welcome back";
    console.log("[getSessionDisplayName] Display name:", displayName);
    return displayName;
  }

  function updateSidebarUserInfo(session) {
    const nameEl = document.getElementById("adminName");
    const roleEl = document.getElementById("adminRole");

    if (nameEl) {
      nameEl.textContent = getSessionDisplayName(session);
    }

    if (roleEl && currentUserRole) {
      const roleLabels = {
        developer: "Developer",
        super_admin: "Super Admin",
        editor: "Editor",
      };
      roleEl.textContent = roleLabels[currentUserRole] || "Admin";

      // Update role badge color
      roleEl.className = "admin-role";
      if (currentUserRole === "developer") {
        roleEl.style.color = "#10b981";
      } else if (currentUserRole === "super_admin") {
        roleEl.style.color = "var(--clr-primary)";
      } else {
        roleEl.style.color = "#3b82f6";
      }
    }
  }

  function getMissingProfileFields(session) {
    console.log("[getMissingProfileFields] Checking profile fields");
    const u = session?.user;
    const meta = u?.user_metadata || {};
    const first = String(meta.first_name || "").trim();
    const last = String(meta.last_name || "").trim();

    const missing = [];
    if (!first) missing.push("first_name");
    if (!last) missing.push("last_name");
    console.log("[getMissingProfileFields] Missing fields:", missing);
    return missing;
  }

  /* =========================
    Complete profile modal
  ========================= */
  function openCompleteProfileModal(session) {
    console.log("[openCompleteProfileModal] Opening profile completion modal");
    const modal = $("#completeProfileModal");
    const firstEl = $("#cpFirstName");
    const lastEl = $("#cpLastName");

    if (!modal || !firstEl || !lastEl) return;

    const meta = session?.user?.user_metadata || {};
    firstEl.value = String(meta.first_name || "");
    lastEl.value = String(meta.last_name || "");

    modal.hidden = false;
    setTimeout(() => firstEl.focus(), 50);
  }

  function closeCompleteProfileModal() {
    console.log("[closeCompleteProfileModal] Closing profile completion modal");
    const modal = $("#completeProfileModal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
  }

  async function saveProfileNames(firstName, lastName) {
    console.log("[saveProfileNames] Saving:", firstName, lastName);
    const { data, error } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName },
    });
    if (error) {
      console.error("[saveProfileNames] Error:", error);
      throw error;
    }
    console.log("[saveProfileNames] Success");

    const status = $("#adminStatusText");
    if (status)
      status.textContent = getSessionDisplayName(
        data?.session || { user: data?.user },
      );

    closeCompleteProfileModal();
  }

  function bindCompleteProfileModal() {
    console.log("[bindCompleteProfileModal] Binding profile completion modal");
    on($("[data-close-complete-profile]"), "click", closeCompleteProfileModal);

    on($("#completeProfileModal"), "click", (e) => {
      if (e.target && e.target.id === "completeProfileModal")
        closeCompleteProfileModal();
    });

    on($("#completeProfileForm"), "submit", async (e) => {
      e.preventDefault();
      const firstName = ($("#cpFirstName")?.value || "").trim();
      const lastName = ($("#cpLastName")?.value || "").trim();
      if (!firstName || !lastName)
        return showToast("Please enter first and last name.");

      const btn = $("#completeProfileForm button[type='submit']");
      setBtnLoading(btn, true, "Saving...");

      try {
        await saveProfileNames(firstName, lastName);
        showToast("Profile updated.");
      } catch (err) {
        showToast("Failed: " + explainError(err));
      } finally {
        setBtnLoading(btn, false);
      }
    });
  }

  async function ensureProfileComplete(session) {
    console.log("[ensureProfileComplete] Checking if profile is complete");
    const missing = getMissingProfileFields(session);
    if (!missing.length) {
      console.log("[ensureProfileComplete] Profile is complete");
      return;
    }
    console.log("[ensureProfileComplete] Profile incomplete, opening modal");
    openCompleteProfileModal(session);
  }

  /* =========================
    Mobile drawer
  ========================= */
  function openNav() {
    console.log("[openNav] Opening navigation drawer");
    document.body.classList.add("nav-open");
    const ov = $("#navOverlay");
    if (ov) ov.hidden = false;

    const ic = $("#menuToggleBtn i");
    if (ic) {
      ic.classList.remove("fa-bars");
      ic.classList.add("fa-xmark");
    }
  }

  function closeNav() {
    console.log("[closeNav] Closing navigation drawer");
    document.body.classList.remove("nav-open");
    const ov = $("#navOverlay");
    if (ov) ov.hidden = true;

    const ic = $("#menuToggleBtn i");
    if (ic) {
      ic.classList.remove("fa-xmark");
      ic.classList.add("fa-bars");
    }
  }

  function bindNav() {
    console.log("[bindNav] Binding navigation handlers");
    on($("#menuToggleBtn"), "click", () => {
      if (document.body.classList.contains("nav-open")) closeNav();
      else openNav();
    });

    on($("#navOverlay"), "click", closeNav);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeNav();
        closeInviteModal();
        closeImgViewer();
        closeCompleteProfileModal();
      }
    });

    $$(".sidebar-nav .nav-item").forEach((b) => {
      on(b, "click", () => {
        if (window.matchMedia("(max-width: 768px)").matches) closeNav();
      });
    });
  }

  /* =========================
    Dashboard view switch
  ========================= */
  function ensureDefaultDashboardView() {
    console.log("[ensureDefaultDashboardView] Setting default view");
    if ($(".content-view.active")) {
      console.log("[ensureDefaultDashboardView] View already active");
      return;
    }
    $("#viewInventory")?.classList.add("active");
    $('[data-view-target="inventory"]')?.classList.add("active");
    const title = $("#pageTitleDisplay");
    if (title) title.textContent = "Inventory";
    console.log("[ensureDefaultDashboardView] Set to Inventory");
  }

  function switchView(viewId) {
    console.log("[switchView] Switching to:", viewId);
    $$(".content-view").forEach((v) => v.classList.remove("active"));
    const target = $(
      `#view${viewId.charAt(0).toUpperCase() + viewId.slice(1)}`,
    );
    if (target) target.classList.add("active");

    $$(".sidebar-nav .nav-item").forEach((b) => b.classList.remove("active"));
    $(`[data-view-target="${viewId}"]`)?.classList.add("active");

    const title = $("#pageTitleDisplay");
    if (title) {
      const titles = {
        dashboard: "Dashboard",
        inventory: "Inventory",
        orders: "Orders",
        studio: "Product Studio",
        activity: "Activity Logs",
        admins: "Manage Admins",
        trash: "Trash",
        siteImages: "Site Images",
        reviews: "Customer Reviews",
        analytics: "Analytics",
        customers: "Customers",
        messages: "Messages",
      };
      title.textContent = titles[viewId] || viewId;
    }

    // Load reviews when navigating to reviews view
    if (viewId === "reviews") {
      loadReviews();
    }

    // If entering studio with no productId, make sure we are in ADD mode
    if (viewId === "studio" && !($("#productId")?.value || "").trim()) {
      setStudioMode(false);
    }

    // Load orders when switching to that view
    if (viewId === "orders") {
      loadOrders();
    }

    // Load activity logs when switching to that view
    if (viewId === "activity") {
      loadActivityLogs();
    }

    // Load admins when switching to that view
    if (viewId === "admins") {
      loadAdmins();
    }

    // Load trash when switching to that view
    if (viewId === "trash") {
      loadTrash();
    }

    // Load site images when switching to that view
    if (viewId === "siteImages") {
      loadSiteImages();
    }

    // Load analytics when switching to that view
    if (viewId === "analytics") {
      loadAnalytics();
    }

    // Load customers when switching to that view
    if (viewId === "customers") {
      loadCustomers();
    }

    // Load messages when switching to that view
    if (viewId === "messages") {
      loadMessages();
    }
  }

  /* =========================
    Activity Logging
  ========================= */
  async function logActivity(action, entity, entityId, metadata = {}) {
    console.log("[logActivity] Logging:", {
      action,
      entity,
      entityId,
      metadata,
    });
    try {
      await supabase.from("admin_activity_logs").insert({
        admin_id: currentUserId,
        action,
        entity,
        entity_id: entityId,
        metadata,
      });
      console.log("[logActivity] Success");
    } catch (err) {
      console.warn("[logActivity] Failed:", err);
    }
  }

  let activityLogsCache = [];

  function formatRelativeTime(dateStr) {
    console.log("[formatRelativeTime] Formatting:", dateStr);
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function getActivityIcon(action) {
    console.log("[getActivityIcon] Getting icon for:", action);
    const icons = {
      create: "fa-plus",
      update: "fa-pen",
      delete: "fa-trash",
      restore: "fa-rotate-left",
      login: "fa-right-to-bracket",
      invite: "fa-user-plus",
    };
    return icons[action] || "fa-circle";
  }

  function getActivityColor(action) {
    console.log("[getActivityColor] Getting color for:", action);
    const colors = {
      create: "#22c55e",
      update: "#3b82f6",
      delete: "#ef4444",
      restore: "#8b5cf6",
      login: "#6366f1",
      invite: "#f59e0b",
    };
    return colors[action] || "var(--text-muted)";
  }

  function getActivityLogCard(log) {
    const icon = getActivityIcon(log.action);
    const color = getActivityColor(log.action);
    const meta = log.metadata || {};
    const name = meta.name || meta.email || log.entity_id || "Unknown";
    const adminName = meta.admin_name || "Admin";
    const adminRole = meta.admin_role || "editor";

    // Get role badge for activity log
    const getRoleBadgeSmall = (role) => {
      if (role === "developer") {
        return '<span class="role-badge-sm developer">Dev</span>';
      }
      if (role === "super_admin") {
        return '<span class="role-badge-sm super">SA</span>';
      }
      return '<span class="role-badge-sm editor">Ed</span>';
    };

    // Build action text
    const actionMap = {
      create: "created",
      update: "updated",
      delete: "deleted",
      restore: "restored",
      login: "logged in",
      logout: "logged out",
      invite: "invited",
    };
    const actionText = actionMap[log.action] || log.action;

    // Build entity display
    const entityType = log.entity_type || log.entity || "";
    const entityDisplay = entityType ? ` a ${entityType}` : "";

    return `
      <article class="activity-card">
        <div class="activity-icon" style="background: ${color}20; color: ${color};">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="activity-info">
          <p class="activity-title">
            <strong>${adminName}</strong> ${getRoleBadgeSmall(adminRole)} ${actionText}${entityDisplay}
          </p>
          <p class="activity-detail">${name !== "Unknown" ? name : ""}</p>
        </div>
        <time class="activity-time">${formatRelativeTime(log.created_at)}</time>
      </article>
    `;
  }

  async function loadActivityLogs() {
    console.log("[loadActivityLogs] Loading activity logs");
    const list = $("#activityLogsList");
    if (!list) return;

    // Show skeleton loading
    showSkeletonList(list, 5);

    const { data, error } = await supabase
      .from("admin_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[loadActivityLogs] Error:", error);
      list.innerHTML =
        '<p class="text-muted text-center">Failed to load activity logs</p>';
      return;
    }

    activityLogsCache = data || [];

    if (!activityLogsCache.length) {
      list.innerHTML = '<p class="text-muted text-center">No activity yet</p>';
      return;
    }

    list.innerHTML = activityLogsCache.map(getActivityLogCard).join("");
  }

  /* =========================
    Manage Admins
  ========================= */
  let adminsCache = [];

  function getRoleBadge(role) {
    console.log("[getRoleBadge] Getting badge for role:", role);
    if (role === "super_admin") {
      return '<span class="role-badge super">Super Admin</span>';
    }
    if (role === "developer") {
      return '<span class="role-badge developer">Developer</span>';
    }
    return '<span class="role-badge editor">Editor</span>';
  }

  function getAdminCard(admin) {
    const name =
      `${admin.first_name || ""} ${admin.last_name || ""}`.trim() || "No name";
    // Developer and super_admin can manage other admins
    const hasFullAccess =
      currentUserRole === "super_admin" || currentUserRole === "developer";
    const canManage = admin.id !== currentUserId && hasFullAccess;
    const isSuperAdmin = admin.role === "super_admin";
    const isDeveloper = admin.role === "developer";

    return `
      <article class="admin-card" data-admin-id="${admin.id}">
        <div class="admin-avatar">
          <i class="fa-solid fa-user"></i>
        </div>
        <div class="admin-info">
          <p class="admin-name">${name}</p>
          ${admin.email ? `<p class="admin-email text-muted">${admin.email}</p>` : ""}
        </div>
        <div class="admin-role">
          ${getRoleBadge(admin.role)}
        </div>
        <div class="admin-actions">
          ${
            canManage && !isDeveloper
              ? `
            ${
              !isSuperAdmin
                ? `
              <button class="btn-role-action" data-promote="${admin.id}" title="Promote to Super Admin">
                <i class="fa-solid fa-arrow-up"></i>
                <span>Promote</span>
              </button>
            `
                : `
              <button class="btn-role-action" data-demote="${admin.id}" title="Demote to Editor">
                <i class="fa-solid fa-arrow-down"></i>
                <span>Demote</span>
              </button>
            `
            }
            <button class="btn-delete-admin" data-delete-admin="${admin.id}" title="Delete Admin">
              <i class="fa-solid fa-trash"></i>
            </button>
          `
              : admin.id === currentUserId
                ? '<span class="text-muted" style="font-size: 0.9rem;">You</span>'
                : isDeveloper
                  ? '<span class="text-muted" style="font-size: 0.9rem;">Protected</span>'
                  : ""
          }
        </div>
      </article>
    `;
  }

  async function loadAdmins() {
    console.log("[loadAdmins] Loading admin list");
    const list = $("#adminsList");
    if (!list) return;

    // Show skeleton loading
    showSkeletonList(list, 4);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, role, created_at")
      .eq("is_admin", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[loadAdmins] Error:", error);
      list.innerHTML =
        '<p class="text-muted text-center">Failed to load admins</p>';
      return;
    }

    adminsCache = data || [];

    if (!adminsCache.length) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-users"></i>
          <p>No admins found</p>
        </div>`;
      return;
    }

    // Sort: developers first, then super_admin, then editors
    const roleOrder = { developer: 0, super_admin: 1, editor: 2 };
    adminsCache.sort((a, b) => {
      const orderA = roleOrder[a.role] ?? 3;
      const orderB = roleOrder[b.role] ?? 3;
      if (orderA !== orderB) return orderA - orderB;
      // Same role: sort by created_at
      return new Date(a.created_at) - new Date(b.created_at);
    });

    list.innerHTML = adminsCache.map(getAdminCard).join("");
  }

  async function promoteToSuperAdmin(adminId) {
    console.log("[promoteToSuperAdmin] Promoting admin:", adminId);
    const admin = adminsCache.find((a) => a.id === adminId);
    if (!admin) return;

    const { error } = await supabase
      .from("profiles")
      .update({ role: "super_admin" })
      .eq("id", adminId);

    if (error) {
      console.error("[promoteToSuperAdmin] Error:", error);
      showToast("Failed to promote admin");
      return;
    }
    console.log("[promoteToSuperAdmin] Success");

    await logActivity("update", "user", adminId, {
      action: "promote_to_super_admin",
      name: `${admin.first_name} ${admin.last_name}`.trim(),
    });

    showToast("Admin promoted to Super Admin");
    await loadAdmins();
  }

  async function demoteToEditor(adminId) {
    console.log("[demoteToEditor] Demoting admin:", adminId);
    const admin = adminsCache.find((a) => a.id === adminId);
    if (!admin) return;

    const { error } = await supabase
      .from("profiles")
      .update({ role: "editor" })
      .eq("id", adminId);

    if (error) {
      console.error("[demoteToEditor] Error:", error);
      showToast("Failed to demote admin");
      return;
    }
    console.log("[demoteToEditor] Success");

    await logActivity("update", "user", adminId, {
      action: "demote_to_editor",
      name: `${admin.first_name} ${admin.last_name}`.trim(),
    });

    showToast("Admin demoted to Editor");
    await loadAdmins();
  }

  async function deleteAdmin(adminId) {
    console.log("[deleteAdmin] Deleting admin:", adminId);
    const admin = adminsCache.find((a) => a.id === adminId);
    if (!admin) return;

    if (
      !confirm(
        `Delete ${admin.first_name} ${admin.last_name}? This will remove their access permanently.`,
      )
    )
      return;

    // Delete from profiles (cascade will handle auth.users if needed)
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", adminId);

    if (error) {
      showToast("Failed to delete admin");
      console.error("[deleteAdmin] Error:", error);
      return;
    }
    console.log("[deleteAdmin] Success");

    await logActivity("delete", "user", adminId, {
      name: `${admin.first_name} ${admin.last_name}`.trim(),
      email: admin.email,
    });

    showToast("Admin deleted");
    await loadAdmins();
  }

  function bindAdminsActions() {
    on($("#adminsList"), "click", async (e) => {
      const promoteBtn = e.target?.closest("button[data-promote]");
      const demoteBtn = e.target?.closest("button[data-demote]");
      const deleteBtn = e.target?.closest("button[data-delete-admin]");

      if (promoteBtn?.dataset?.promote) {
        await promoteToSuperAdmin(promoteBtn.dataset.promote);
        return;
      }

      if (demoteBtn?.dataset?.demote) {
        await demoteToEditor(demoteBtn.dataset.demote);
        return;
      }

      if (deleteBtn?.dataset?.deleteAdmin) {
        await deleteAdmin(deleteBtn.dataset.deleteAdmin);
        return;
      }
    });

    // Alternative invite button from admins page
    on($("#openInviteFromAdminsBtn"), "click", openInviteModal);
  }

  /* =========================
    Site Images Management
  ========================= */
  let siteSettingsCache = {};

  async function loadSiteImages() {
    console.log("[loadSiteImages] Loading site images settings");

    const { data, error } = await supabase.from("site_settings").select("*");

    if (error) {
      console.error("[loadSiteImages] Error:", error);
      showToast("Failed to load site images");
      return;
    }

    // Convert to object keyed by setting key
    siteSettingsCache = {};
    (data || []).forEach((setting) => {
      siteSettingsCache[setting.key] = setting.value;
    });

    // Update UI
    updateSiteImagePreviews();
  }

  function updateSiteImagePreviews() {
    // Hero image
    const heroUrl = siteSettingsCache.hero_image?.url || "";
    const heroPreview = $("#heroImagePreview img");
    const heroInput = $("#heroImageUrl");
    if (heroPreview) heroPreview.src = heroUrl || "assets/img/placeholder.jpg";
    if (heroInput) heroInput.value = heroUrl;

    // Lingerie
    const lingerieUrl = siteSettingsCache.category_lingerie?.url || "";
    const lingeriePreview = $("#lingerieImagePreview img");
    const lingerieInput = $("#lingerieImageUrl");
    if (lingeriePreview)
      lingeriePreview.src = lingerieUrl || "assets/img/placeholder.jpg";
    if (lingerieInput) lingerieInput.value = lingerieUrl;

    // Loungewear
    const loungewearUrl = siteSettingsCache.category_loungewear?.url || "";
    const loungewearPreview = $("#loungewearImagePreview img");
    const loungewearInput = $("#loungewearImageUrl");
    if (loungewearPreview)
      loungewearPreview.src = loungewearUrl || "assets/img/placeholder.jpg";
    if (loungewearInput) loungewearInput.value = loungewearUrl;

    // Underwear
    const underwearUrl = siteSettingsCache.category_underwear?.url || "";
    const underwearPreview = $("#underwearImagePreview img");
    const underwearInput = $("#underwearImageUrl");
    if (underwearPreview)
      underwearPreview.src = underwearUrl || "assets/img/placeholder.jpg";
    if (underwearInput) underwearInput.value = underwearUrl;
  }

  async function saveSiteImages() {
    console.log("[saveSiteImages] Saving site images");

    const updates = [
      {
        key: "hero_image",
        value: { url: $("#heroImageUrl")?.value || "", alt: "Hero image" },
      },
      {
        key: "category_lingerie",
        value: { url: $("#lingerieImageUrl")?.value || "", alt: "Lingerie" },
      },
      {
        key: "category_loungewear",
        value: {
          url: $("#loungewearImageUrl")?.value || "",
          alt: "Loungewear",
        },
      },
      {
        key: "category_underwear",
        value: { url: $("#underwearImageUrl")?.value || "", alt: "Underwear" },
      },
    ];

    const btn = $("#saveSiteImagesBtn");
    setBtnLoading(btn, true, "Saving...");

    try {
      for (const update of updates) {
        const { error } = await supabase.from("site_settings").upsert(
          {
            key: update.key,
            value: update.value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );

        if (error) {
          console.error("[saveSiteImages] Error saving", update.key, error);
          throw error;
        }
      }

      showToast("Site images saved successfully!");
      await logActivity("update", "site_settings", null, {
        action: "Updated site images",
      });

      // Refresh cache
      await loadSiteImages();

      // Signal home page to refresh (if open in another tab)
      localStorage.setItem("lbs_site_images_updated", Date.now().toString());
    } catch (err) {
      console.error("[saveSiteImages] Error:", err);
      showToast("Failed to save site images");
    } finally {
      setBtnLoading(btn, false);
    }
  }

  function bindSiteImagesActions() {
    console.log("[bindSiteImagesActions] Binding site images actions");

    // Save button
    on($("#saveSiteImagesBtn"), "click", saveSiteImages);

    // URL input change -> update preview
    on($("#heroImageUrl"), "input", (e) => {
      const preview = $("#heroImagePreview img");
      if (preview) preview.src = e.target.value || "assets/img/placeholder.jpg";
    });

    on($("#lingerieImageUrl"), "input", (e) => {
      const preview = $("#lingerieImagePreview img");
      if (preview) preview.src = e.target.value || "assets/img/placeholder.jpg";
    });

    on($("#loungewearImageUrl"), "input", (e) => {
      const preview = $("#loungewearImagePreview img");
      if (preview) preview.src = e.target.value || "assets/img/placeholder.jpg";
    });

    on($("#underwearImageUrl"), "input", (e) => {
      const preview = $("#underwearImagePreview img");
      if (preview) preview.src = e.target.value || "assets/img/placeholder.jpg";
    });

    // Upload buttons - trigger file input
    $$(".btn-upload").forEach((btn) => {
      on(btn, "click", () => {
        const fileInputId = btn.dataset.uploadFor;
        const fileInput = $("#" + fileInputId);
        if (fileInput) fileInput.click();
      });
    });

    // File input change - upload to storage and update preview
    $$(".image-file-input").forEach((input) => {
      on(input, "change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const card = input.closest(".image-upload-card");
        const previewImg = card?.querySelector(".image-preview img");
        const urlInput = card?.querySelector(".image-url-input");

        // Show loading state
        if (previewImg) previewImg.style.opacity = "0.5";

        try {
          // Upload to Supabase Storage - bucket name should be 'site-images'
          const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const { data, error } = await supabase.storage
            .from("site-images")
            .upload(fileName, file, { cacheControl: "3600", upsert: true });

          if (error) {
            console.error("[uploadSiteImage] Storage error:", error);
            // Check specific error types
            if (error.message?.includes("bucket") || error.statusCode === 400) {
              showToast(
                "Storage bucket 'site-images' not found. Create it in Supabase Dashboard → Storage.",
              );
            } else if (
              error.message?.includes("policy") ||
              error.statusCode === 403
            ) {
              showToast("Upload not allowed. Check storage bucket policies.");
            } else {
              showToast("Upload failed: " + (error.message || "Unknown error"));
            }
            if (previewImg) previewImg.style.opacity = "1";
            return;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("site-images")
            .getPublicUrl(fileName);

          const publicUrl = urlData?.publicUrl;

          // Update UI
          if (previewImg) {
            previewImg.src = publicUrl;
            previewImg.style.opacity = "1";
          }
          if (urlInput) urlInput.value = publicUrl;

          showToast("Image uploaded successfully!");
        } catch (err) {
          console.error("[uploadSiteImage] Error:", err);
          showToast("Upload failed. Check console for details.");
          if (previewImg) previewImg.style.opacity = "1";
        }
      });
    });

    // Tab switching between URL and Upload - both methods work together
    $$(".input-tab").forEach((tab) => {
      on(tab, "click", () => {
        const group = tab.closest(".image-input-group");
        const tabs = group?.querySelectorAll(".input-tab");
        const fileInput = group?.querySelector(".image-file-input");

        // Update active state for visual feedback
        tabs?.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Upload tab opens file picker
        if (tab.dataset.tab === "upload" && fileInput) {
          fileInput.click();
        }
        // URL tab focuses on URL input
        if (tab.dataset.tab === "url") {
          const urlInput = group?.querySelector(".image-url-input");
          if (urlInput) urlInput.focus();
        }
      });
    });
  }

  /* =========================
    Trash (Deleted Products)
  ========================= */
  let trashCache = [];

  function getTrashCard(p) {
    console.log("[getTrashCard] Generating trash card for:", p?.name);
    const img =
      p.images && p.images[0] ? p.images[0] : "assets/img/placeholder.jpg";
    const deletedDate = p.updated_at
      ? formatRelativeTime(p.updated_at)
      : "Unknown";

    return `
      <article class="trash-card" data-product-id="${p.id}">
        <div class="trash-thumb">
          <img src="${img}" alt="${p.name || "Product"}" loading="lazy">
        </div>
        <div class="trash-info">
          <p class="trash-name">${p.name || "Untitled"}</p>
          <p class="trash-meta">${p.category || "No category"} • Deleted ${deletedDate}</p>
        </div>
        <div class="trash-actions">
          <button class="btn-restore" data-restore="${p.id}">
            <i class="fa-solid fa-rotate-left"></i>
            <span>Restore</span>
          </button>
          <button class="btn-perma-delete" data-perma-delete="${p.id}">
            <i class="fa-solid fa-trash"></i>
            <span>Delete</span>
          </button>
        </div>
      </article>
    `;
  }

  async function loadTrash() {
    console.log("[loadTrash] Loading trash items");
    const list = $("#trashProductsList");
    if (!list) return;

    // Show skeleton loading
    showSkeletonList(list, 4);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_deleted", true)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[loadTrash] Error:", error);
      list.innerHTML =
        '<p class="text-muted text-center">Failed to load deleted products</p>';
      return;
    }

    trashCache = data || [];

    if (!trashCache.length) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-trash-can"></i>
          <p>Trash is empty</p>
          <span class="text-muted" style="font-size: 0.75rem;">Deleted products will appear here</span>
        </div>`;
      return;
    }

    list.innerHTML = trashCache.map(getTrashCard).join("");
  }

  async function restoreProduct(id) {
    console.log("[restoreProduct] Restoring product:", id);
    const product = trashCache.find((p) => String(p.id) === String(id));

    const { error } = await supabase
      .from("products")
      .update({ is_deleted: false })
      .eq("id", id);

    if (error) {
      console.error("[restoreProduct] Error:", error);
      showToast("Restore failed");
      return;
    }
    console.log("[restoreProduct] Success");

    await logActivity("restore", "product", id, {
      name: product?.name || "Unknown",
    });
    showToast("Product restored");
    await loadTrash();
    await loadInventory();
  }

  async function permanentlyDeleteProduct(id) {
    console.log("[permanentlyDeleteProduct] Permanently deleting:", id);
    const product = trashCache.find((p) => String(p.id) === String(id));

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("[permanentlyDeleteProduct] Error:", error);
      showToast("Delete failed");
      return;
    }
    console.log("[permanentlyDeleteProduct] Success");

    await logActivity("delete", "product", id, {
      name: product?.name || "Unknown",
      permanent: true,
    });
    showToast("Permanently deleted");
    await loadTrash();
  }

  async function emptyTrash() {
    console.log("[emptyTrash] Emptying trash, items:", trashCache.length);
    if (!trashCache.length) {
      showToast("Trash is already empty");
      return;
    }

    if (
      !confirm(
        `Permanently delete ${trashCache.length} item(s)? This cannot be undone.`,
      )
    )
      return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("is_deleted", true);

    if (error) {
      console.error("[emptyTrash] Error:", error);
      showToast("Failed to empty trash");
      return;
    }
    console.log("[emptyTrash] Success");

    await logActivity("delete", "product", null, {
      action: "empty_trash",
      count: trashCache.length,
    });
    showToast("Trash emptied");
    await loadTrash();
  }

  function bindTrashActions() {
    console.log("[bindTrashActions] Binding trash action handlers");
    on($("#trashProductsList"), "click", async (e) => {
      const restoreBtn = e.target?.closest("button[data-restore]");
      const deleteBtn = e.target?.closest("button[data-perma-delete]");

      if (restoreBtn?.dataset?.restore) {
        await restoreProduct(restoreBtn.dataset.restore);
        return;
      }

      if (deleteBtn?.dataset?.permaDelete) {
        if (!confirm("Permanently delete this product? This cannot be undone."))
          return;
        await permanentlyDeleteProduct(deleteBtn.dataset.permaDelete);
        return;
      }
    });

    on($("#emptyTrashBtn"), "click", emptyTrash);
  }

  /* =========================
    Orders Management
  ========================= */
  let ordersCache = [];
  let currentOrdersPage = 1;
  const ORDERS_PER_PAGE = 10;
  let currentOrderStatus = "";
  let currentOrderId = null;

  async function loadOrders() {
    console.log(
      "[loadOrders] Loading orders, status filter:",
      currentOrderStatus,
    );
    const tbody = $("#ordersTableBody");
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="7"><div class="skeleton skeleton-text" style="height:16px;margin:8px 0"></div></td></tr><tr><td colspan="7"><div class="skeleton skeleton-text skeleton-text--long" style="height:16px;margin:8px 0"></div></td></tr><tr><td colspan="7"><div class="skeleton skeleton-text skeleton-text--med" style="height:16px;margin:8px 0"></div></td></tr>';

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (currentOrderStatus) {
      query = query.eq("status", currentOrderStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[loadOrders] Error:", error);
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">Failed to load orders</td></tr>';
      return;
    }

    ordersCache = data || [];
    console.log("[loadOrders] Loaded", ordersCache.length, "orders");

    updateOrderStats();
    renderOrdersTable();
  }

  function updateOrderStats() {
    const pending = ordersCache.filter((o) => o.status === "pending").length;
    const processing = ordersCache.filter(
      (o) => o.status === "processing",
    ).length;
    const shipped = ordersCache.filter((o) => o.status === "shipped").length;
    const delivered = ordersCache.filter(
      (o) => o.status === "delivered",
    ).length;

    const el = (id, val) => {
      const elem = $(`#${id}`);
      if (elem) elem.textContent = val;
    };

    el("pendingOrdersCount", pending);
    el("processingOrdersCount", processing);
    el("shippedOrdersCount", shipped);
    el("deliveredOrdersCount", delivered);
  }

  function renderOrdersTable() {
    const tbody = $("#ordersTableBody");
    if (!tbody) return;

    if (!ordersCache.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">No orders found</td></tr>';
      return;
    }

    const start = (currentOrdersPage - 1) * ORDERS_PER_PAGE;
    const end = start + ORDERS_PER_PAGE;
    const pageOrders = ordersCache.slice(start, end);

    tbody.innerHTML = pageOrders
      .map((order) => {
        const date = new Date(order.created_at).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        const items = order.items || [];
        const itemCount = items.reduce(
          (sum, item) => sum + (item.quantity || 1),
          0,
        );

        return `
        <tr>
          <td data-label="Order ID"><span class="order-id">#${order.id.slice(0, 8)}</span></td>
          <td data-label="Date">${date}</td>
          <td data-label="Customer">
            <div class="order-customer">
              <span class="name">${order.customer_name || "Guest"}</span>
            </div>
          </td>
          <td data-label="Items"><span class="order-items-count">${itemCount} item${itemCount !== 1 ? "s" : ""}</span></td>
          <td data-label="Total"><span class="order-total">₦${(order.total || 0).toLocaleString()}</span></td>
          <td data-label="Status"><span class="order-status ${order.status}">${order.status}</span></td>
          <td data-label="Action">
            <div class="order-actions">
              <button type="button" class="btn btn-sm btn-outline" data-view-order="${order.id}" title="View Details">
                <i class="fa-solid fa-eye"></i> View
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    // Pagination
    const totalPages = Math.ceil(ordersCache.length / ORDERS_PER_PAGE);
    const paginationEl = $("#ordersPagination");
    const pageInfo = $("#ordersPageInfo");
    const prevBtn = $("#ordersPrevBtn");
    const nextBtn = $("#ordersNextBtn");

    if (paginationEl && totalPages > 1) {
      paginationEl.hidden = false;
      if (pageInfo)
        pageInfo.textContent = `Page ${currentOrdersPage} of ${totalPages}`;
      if (prevBtn) prevBtn.disabled = currentOrdersPage <= 1;
      if (nextBtn) nextBtn.disabled = currentOrdersPage >= totalPages;
    } else if (paginationEl) {
      paginationEl.hidden = true;
    }
  }

  // Status flow: what actions are available for each status
  const STATUS_FLOW = {
    pending: {
      next: "processing",
      nextLabel: "Process Order",
      nextIcon: "fa-gear",
      canCancel: true,
    },
    processing: {
      next: "shipped",
      nextLabel: "Ship Order",
      nextIcon: "fa-truck-fast",
      canCancel: true,
    },
    shipped: {
      next: "delivered",
      nextLabel: "Mark Delivered",
      nextIcon: "fa-circle-check",
      canCancel: false,
    },
    delivered: {
      next: null,
      nextLabel: null,
      nextIcon: null,
      canCancel: false,
    },
    cancelled: {
      next: null,
      nextLabel: null,
      nextIcon: null,
      canCancel: false,
    },
  };

  function buildOrderTimeline(status) {
    const steps = [
      { key: "pending", label: "Pending", icon: "fa-clock" },
      { key: "processing", label: "Processing", icon: "fa-gear" },
      { key: "shipped", label: "Shipped", icon: "fa-truck-fast" },
      { key: "delivered", label: "Delivered", icon: "fa-circle-check" },
    ];
    if (status === "cancelled") {
      return `<div class="admin-timeline"><div class="admin-timeline-step cancelled"><i class="fa-solid fa-ban"></i><span>Cancelled</span></div></div>`;
    }
    const idx = steps.findIndex((s) => s.key === status);
    return `<div class="admin-timeline">${steps
      .map((s, i) => {
        // Delivered step should always show as "done" (green), not "active" (pink)
        const cls =
          i < idx
            ? "done"
            : i === idx
              ? s.key === "delivered"
                ? "done"
                : "active"
              : "";
        return `<div class="admin-timeline-step ${cls}"><div class="admin-timeline-dot"><i class="fa-solid ${s.icon}"></i></div><span>${s.label}</span></div>`;
      })
      .join('<div class="admin-timeline-line"></div>')}</div>`;
  }

  function renderOrderStatusActions(status) {
    const footer = $("#orderModalFooter");
    if (!footer) return;
    const flow = STATUS_FLOW[status] || {};
    let html = "";
    if (flow.next) {
      html += `<button type="button" class="btn btn-primary" data-set-status="${flow.next}"><i class="fa-solid ${flow.nextIcon}"></i> ${flow.nextLabel}</button>`;
    }
    if (flow.canCancel) {
      html += `<button type="button" class="btn btn-danger btn-outline" data-set-status="cancelled"><i class="fa-solid fa-ban"></i> Cancel Order</button>`;
    }
    if (!flow.next && !flow.canCancel) {
      html += `<span class="order-final-status"><i class="fa-solid fa-check"></i> Order ${status}</span>`;
    }
    footer.innerHTML = html;
  }

  function openOrderModal(orderId) {
    console.log("[openOrderModal] Opening order:", orderId);
    const order = ordersCache.find((o) => o.id === orderId);
    if (!order) return;

    currentOrderId = orderId;
    const modal = $("#orderDetailModal");
    const body = $("#orderModalBody");
    if (!modal || !body) return;

    const items = order.items || [];
    const date = new Date(order.created_at).toLocaleString("en-NG");
    const status = order.status || "pending";
    const orderNum = order.order_number || `#${order.id.slice(0, 8)}`;
    const shippingAddr =
      [
        order.delivery_address || order.shipping_address,
        order.delivery_city,
        order.delivery_state,
      ]
        .filter(Boolean)
        .join(", ") || "Not provided";

    body.innerHTML = `
      <div class="order-modal-status-bar">
        <span class="order-status ${status}">${status}</span>
        <span class="order-modal-id">${orderNum}</span>
        <span class="order-modal-date"><i class="fa-regular fa-calendar"></i> ${date}</span>
      </div>
      ${buildOrderTimeline(status)}
      <div class="order-modal-grid">
        <div class="order-detail-section compact">
          <h4><i class="fa-solid fa-user"></i> Customer</h4>
          <p><strong>${order.customer_name || "Guest"}</strong></p>
          <p>${order.customer_email || "-"}</p>
          <p>${order.customer_phone || "-"}</p>
        </div>
        <div class="order-detail-section compact">
          <h4><i class="fa-solid fa-location-dot"></i> Shipping</h4>
          <p>${shippingAddr}</p>
        </div>
        <div class="order-detail-section compact">
          <h4><i class="fa-solid fa-credit-card"></i> Payment</h4>
          <p>${order.payment_method || "Monnify"}</p>
          <p class="text-muted">${order.payment_reference || "-"}</p>
        </div>
      </div>
      <div class="order-detail-section">
        <h4><i class="fa-solid fa-boxes-stacked"></i> Items (${items.length})</h4>
        ${items
          .map(
            (item) => `
          <div class="order-item-row">
            <img src="${item.image || item.images?.[0] || "assets/img/placeholder.png"}" alt="${escapeHtml(item.name)}" class="order-item-img" />
            <div class="order-item-info">
              <div class="order-item-name">${escapeHtml(item.name)}</div>
              <div class="order-item-meta">Size: ${item.size || item.selectedSize || "-"} &middot; Qty: ${item.quantity || item.qty || 1}</div>
            </div>
            <div class="order-item-price">₦${((item.price || item.price_ngn || 0) * (item.quantity || item.qty || 1)).toLocaleString()}</div>
          </div>`,
          )
          .join("")}
      </div>
      <div class="order-detail-section order-summary-section">
        <div class="order-detail-row"><span>Subtotal</span><span>₦${(order.subtotal || order.total || 0).toLocaleString()}</span></div>
        <div class="order-detail-row"><span>Shipping</span><span>₦${(order.shipping_cost || 0).toLocaleString()}</span></div>
        ${order.discount_amount ? `<div class="order-detail-row"><span>Discount${order.promo_code ? " (" + order.promo_code + ")" : ""}</span><span style="color:var(--success)">-₦${order.discount_amount.toLocaleString()}</span></div>` : ""}
        <div class="order-detail-row total"><span>Total</span><span>₦${(order.total || 0).toLocaleString()}</span></div>
      </div>`;

    renderOrderStatusActions(status);
    modal.hidden = false;
  }

  function closeOrderModal() {
    const modal = $("#orderDetailModal");
    if (modal) modal.hidden = true;
    currentOrderId = null;
  }

  async function updateOrderStatusTo(newStatus) {
    if (!currentOrderId) return;
    if (
      newStatus === "cancelled" &&
      !confirm("Are you sure you want to cancel this order?")
    )
      return;

    console.log(
      "[updateOrderStatus] Updating order",
      currentOrderId,
      "to",
      newStatus,
    );

    const btn = $(`[data-set-status="${newStatus}"]`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", currentOrderId);

    if (error) {
      console.error("[updateOrderStatus] Error:", error);
      showToast("Failed to update status");
      if (btn) {
        btn.disabled = false;
      }
      return;
    }

    await logActivity("update", "order", currentOrderId, { status: newStatus });
    showToast(`Order status updated to ${newStatus}`);
    closeOrderModal();
    await loadOrders();
  }

  // Legacy wrapper
  async function updateOrderStatus() {
    const statusSelect = $("#orderStatusSelect");
    if (statusSelect?.value) await updateOrderStatusTo(statusSelect.value);
  }

  function bindOrdersActions() {
    console.log("[bindOrdersActions] Binding orders action handlers");

    // Status filter
    on($("#orderStatusFilter"), "change", (e) => {
      currentOrderStatus = e.target.value;
      currentOrdersPage = 1;
      loadOrders();
    });

    // Refresh button
    on($("#refreshOrdersBtn"), "click", loadOrders);
    on($("#refreshActivityBtn"), "click", loadActivityLogs);

    // View order details
    on($("#ordersTableBody"), "click", (e) => {
      const viewBtn = e.target?.closest("[data-view-order]");
      if (viewBtn) {
        openOrderModal(viewBtn.dataset.viewOrder);
      }
    });

    // Close modal
    on($("#closeOrderModal"), "click", closeOrderModal);
    on($("#orderDetailModal"), "click", (e) => {
      if (e.target.id === "orderDetailModal") closeOrderModal();
    });

    // Status action buttons (delegated)
    on($("#orderModalFooter"), "click", (e) => {
      const btn = e.target?.closest("[data-set-status]");
      if (btn) updateOrderStatusTo(btn.dataset.setStatus);
    });

    // Legacy update status button
    on($("#updateOrderStatusBtn"), "click", updateOrderStatus);

    // Pagination
    on($("#ordersPrevBtn"), "click", () => {
      if (currentOrdersPage > 1) {
        currentOrdersPage--;
        renderOrdersTable();
      }
    });

    on($("#ordersNextBtn"), "click", () => {
      const totalPages = Math.ceil(ordersCache.length / ORDERS_PER_PAGE);
      if (currentOrdersPage < totalPages) {
        currentOrdersPage++;
        renderOrdersTable();
      }
    });
  }

  /* =========================
    Inventory Search & Filter
  ========================= */
  let searchQuery = "";
  let categoryFilter = "";
  let stockFilter = "";

  function filterAndRenderProducts() {
    console.log("[filterAndRenderProducts] Filtering with:", {
      searchQuery,
      categoryFilter,
      stockFilter,
      currentPage,
    });
    const list = $("#adminProductsList");
    const noResults = $("#noResultsMsg");
    const count = $("#productCountText");
    const paginationBar = $("#paginationBar");
    if (!list) return;

    let filtered = productsCache;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q),
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    // Stock filter
    if (stockFilter === "in-stock") {
      filtered = filtered.filter((p) => p.qty > 0);
    } else if (stockFilter === "out-of-stock") {
      filtered = filtered.filter((p) => p.qty <= 0);
    }

    if (count) count.textContent = String(filtered.length);

    // Pagination
    totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedItems = filtered.slice(startIdx, endIdx);

    // Show/hide pagination
    if (paginationBar) {
      paginationBar.hidden = totalPages <= 1;
      updatePaginationUI();
    }

    if (!filtered.length) {
      list.innerHTML = "";
      if (noResults) noResults.hidden = false;
    } else {
      if (noResults) noResults.hidden = true;
      list.innerHTML = paginatedItems.map(getProductCard).join("");

      // Re-apply selection state if in bulk mode
      if (bulkMode) {
        paginatedItems.forEach((p) => {
          if (selectedProducts.has(p.id)) {
            const card = list.querySelector(`[data-product-id="${p.id}"]`);
            if (card) card.classList.add("selected");
          }
        });
      }
    }
  }

  function updatePaginationUI() {
    const pageInfo = $("#pageInfo");
    const prevBtn = $("#pagePrev");
    const nextBtn = $("#pageNext");

    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  function bindPagination() {
    console.log("[bindPagination] Binding pagination");
    on($("#pagePrev"), "click", () => {
      if (currentPage > 1) {
        currentPage--;
        filterAndRenderProducts();
      }
    });
    on($("#pageNext"), "click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        filterAndRenderProducts();
      }
    });
  }

  /* =========================
    Bulk Selection
  ========================= */
  function toggleBulkMode(enabled) {
    console.log("[toggleBulkMode]", enabled);
    bulkMode = enabled;
    document.body.classList.toggle("bulk-mode", enabled);

    const bar = $("#bulkActionsBar");
    if (bar)
      bar.classList.toggle("active", enabled && selectedProducts.size > 0);

    if (!enabled) {
      selectedProducts.clear();
      $$(".product-card.selected").forEach((card) =>
        card.classList.remove("selected"),
      );
    }

    updateBulkUI();
  }

  function toggleProductSelection(productId) {
    console.log("[toggleProductSelection]", productId);
    if (selectedProducts.has(productId)) {
      selectedProducts.delete(productId);
    } else {
      selectedProducts.add(productId);
    }

    const card = $(`[data-product-id="${productId}"]`);
    if (card)
      card.classList.toggle("selected", selectedProducts.has(productId));

    updateBulkUI();
  }

  function updateBulkUI() {
    const bar = $("#bulkActionsBar");
    const countEl = $("#bulkCount");

    if (countEl) countEl.textContent = selectedProducts.size;
    if (bar)
      bar.classList.toggle("active", bulkMode && selectedProducts.size > 0);
  }

  async function bulkDeleteProducts() {
    console.log("[bulkDeleteProducts] Deleting:", selectedProducts.size);

    if (!selectedProducts.size) return;

    const confirmed = await showConfirmModal({
      title: `Delete ${selectedProducts.size} products?`,
      message:
        "These products will be moved to trash. You can restore them later.",
      type: "danger",
      confirmText: "Delete All",
    });

    if (!confirmed) return;

    const ids = Array.from(selectedProducts);
    const { error } = await supabase
      .from("products")
      .update({ is_deleted: true })
      .in("id", ids);

    if (error) {
      console.error("[bulkDeleteProducts] Error:", error);
      showToast("Bulk delete failed");
      return;
    }

    await logActivity("delete", "product", null, {
      action: "bulk_delete",
      count: ids.length,
    });

    // Show undo
    showUndoToast(`${ids.length} products deleted`, async () => {
      await supabase
        .from("products")
        .update({ is_deleted: false })
        .in("id", ids);
      showToast("Products restored");
      await loadInventory();
    });

    toggleBulkMode(false);
    await loadInventory();
  }

  function bindBulkActions() {
    console.log("[bindBulkActions] Binding bulk actions");
    on($("#bulkDeleteBtn"), "click", bulkDeleteProducts);
    on($("#bulkCancelBtn"), "click", () => toggleBulkMode(false));
  }

  function bindSearchAndFilter() {
    console.log("[bindSearchAndFilter] Binding search and filter handlers");
    const searchInput = $("#inventorySearch");
    const searchClear = $("#searchClearBtn");

    // Category filter dropdown
    const catTrigger = $("#categoryFilterTrigger");
    const catMenu = $("#categoryFilterMenu");
    const catLabel = $("#categoryFilterLabel");

    // Stock filter dropdown
    const stockTrigger = $("#stockFilterTrigger");
    const stockMenu = $("#stockFilterMenu");
    const stockLabel = $("#stockFilterLabel");

    // Create backdrop for mobile bottom sheet
    let backdrop = document.querySelector(".ms-dropdown-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "ms-dropdown-backdrop";
      backdrop.hidden = true;
      document.body.appendChild(backdrop);
    }

    const isMobile = () => window.innerWidth <= 480;

    const showDropdown = (menu) => {
      menu.hidden = false;
      if (isMobile()) backdrop.hidden = false;
    };

    const hideAllDropdowns = () => {
      if (catMenu) catMenu.hidden = true;
      if (stockMenu) stockMenu.hidden = true;
      backdrop.hidden = true;
    };

    // Close on backdrop click
    backdrop.addEventListener("click", hideAllDropdowns);
    backdrop.addEventListener("touchend", (e) => {
      e.preventDefault();
      hideAllDropdowns();
    });

    // Search input handlers
    on(searchInput, "input", (e) => {
      searchQuery = (e.target.value || "").trim();
      if (searchClear) searchClear.hidden = !searchQuery;
      filterAndRenderProducts();
    });

    on(searchClear, "click", () => {
      if (searchInput) searchInput.value = "";
      searchQuery = "";
      if (searchClear) searchClear.hidden = true;
      filterAndRenderProducts();
    });

    // Category filter dropdown
    if (catTrigger && catMenu && catLabel) {
      const handleCatTrigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasHidden = catMenu.hidden;
        hideAllDropdowns();
        if (wasHidden) showDropdown(catMenu);
      };

      catTrigger.addEventListener("click", handleCatTrigger);
      catTrigger.addEventListener("touchend", handleCatTrigger);

      const handleCatSelect = (e) => {
        const item = e.target.closest(".ms-item");
        if (!item) return;
        e.preventDefault();

        const value = item.dataset.value || "";
        categoryFilter = value;
        catLabel.textContent = item.textContent.trim();
        hideAllDropdowns();
        filterAndRenderProducts();
      };

      catMenu.addEventListener("click", handleCatSelect);
      catMenu.addEventListener("touchend", handleCatSelect);
    }

    // Stock filter dropdown
    if (stockTrigger && stockMenu && stockLabel) {
      const handleStockTrigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasHidden = stockMenu.hidden;
        hideAllDropdowns();
        if (wasHidden) showDropdown(stockMenu);
      };

      stockTrigger.addEventListener("click", handleStockTrigger);
      stockTrigger.addEventListener("touchend", handleStockTrigger);

      const handleStockSelect = (e) => {
        const item = e.target.closest(".ms-item");
        if (!item) return;
        e.preventDefault();

        const value = item.dataset.value || "";
        stockFilter = value;
        stockLabel.textContent = item.textContent.trim();
        hideAllDropdowns();
        filterAndRenderProducts();
      };

      stockMenu.addEventListener("click", handleStockSelect);
      stockMenu.addEventListener("touchend", handleStockSelect);
    }

    // Close dropdowns when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".ms-wrapper")) {
        hideAllDropdowns();
      }
    });
  }

  /* =========================
    Inventory + Viewer modal
  ========================= */
  let productsCache = [];

  const formatMoney = (n) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(n || 0);

  function getProductCard(p) {
    console.log("[getProductCard] Generating card for:", p?.name);
    const img =
      p.images && p.images[0] ? p.images[0] : "assets/img/placeholder.jpg";
    const stockClass = p.qty > 0 ? "text-muted" : "text-danger";
    const stockText = p.qty > 0 ? `${p.qty} in stock` : "Out of Stock";
    const isSelected = selectedProducts.has(p.id);

    return `
      <article class="product-card ${isSelected ? "selected" : ""}" data-product-id="${p.id}">
        <div class="select-checkbox" data-select="${p.id}">
          <i class="fa-solid fa-check"></i>
        </div>
        <div class="card-media" data-open-images="1">
          <img src="${img}" alt="${p.name || "Product"}" loading="lazy">
        </div>

        <div class="card-info">
          <h4 class="card-title">${p.name || "Untitled"}</h4>

          <div class="card-meta">
            <strong style="color:var(--primary)">${formatMoney(p.price_ngn)}</strong>
            <span class="${stockClass}" style="font-size:0.86rem; font-weight:800;">${stockText}</span>
          </div>

          <div class="card-actions">
            <button class="btn-sm edit" data-edit="${p.id}">
              <i class="fa-regular fa-pen-to-square"></i>
              <span>Edit</span>
            </button>

            <button class="btn-sm del" data-delete="${p.id}">
              <i class="fa-regular fa-trash-can"></i>
              <span>Remove</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  async function loadInventory() {
    console.log("[loadInventory] Loading products");
    const list = $("#adminProductsList");
    const count = $("#productCountText");
    if (!list) return;

    // Show skeleton loading
    showSkeletonGrid(list, 8);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[loadInventory] Error:", error);
      showToast("Failed to load products");
      return;
    }

    productsCache = data || [];
    console.log("[loadInventory] Loaded products:", productsCache.length);

    // Reset pagination when loading fresh data
    currentPage = 1;

    // Apply current filters
    filterAndRenderProducts();
  }

  let viewerIndex = 0;
  let viewerImages = [];

  function renderViewer() {
    console.log(
      "[renderViewer] Rendering viewer, index:",
      viewerIndex,
      "images:",
      viewerImages.length,
    );
    const track = $("#imgViewerTrack");
    const dots = $("#imgViewerDots");
    if (!track) return;

    track.innerHTML = viewerImages
      .map(
        (src) =>
          `<div class="slide"><img src="${src}" alt="Product image"></div>`,
      )
      .join("");
    viewerIndex = Math.max(0, Math.min(viewerIndex, viewerImages.length - 1));
    track.style.transform = `translateX(-${viewerIndex * 100}%)`;

    const count = $("#imgViewerCount");
    if (count)
      count.textContent = `${viewerImages.length} image${viewerImages.length === 1 ? "" : "s"}`;

    if (dots) {
      if (viewerImages.length > 1) {
        dots.hidden = false;
        dots.innerHTML = viewerImages
          .map(
            (_, i) =>
              `<button type="button" class="${i === viewerIndex ? "active" : ""}" data-dot="${i}" aria-label="Go to ${i + 1}"></button>`,
          )
          .join("");
      } else {
        dots.hidden = true;
        dots.innerHTML = "";
      }
    }

    const prev = $("[data-viewer-prev]");
    const next = $("[data-viewer-next]");
    if (prev) prev.disabled = viewerImages.length <= 1 || viewerIndex === 0;
    if (next)
      next.disabled =
        viewerImages.length <= 1 || viewerIndex === viewerImages.length - 1;
  }

  function openImgViewer(product) {
    console.log("[openImgViewer] Opening viewer for:", product?.name);
    const modal = $("#imgViewerModal");
    if (!modal) return;

    viewerImages = product?.images?.length
      ? product.images
      : ["assets/img/placeholder.jpg"];
    viewerIndex = 0;

    const title = $("#imgViewerTitle");
    if (title) title.textContent = product?.name || "Product";

    modal.hidden = false;
    renderViewer();
  }

  function closeImgViewer() {
    console.log("[closeImgViewer] Closing image viewer");
    const modal = $("#imgViewerModal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    viewerImages = [];
    viewerIndex = 0;
  }

  function bindViewerModal() {
    console.log("[bindViewerModal] Binding image viewer modal");
    on($("[data-close-viewer]"), "click", closeImgViewer);
    on($("#imgViewerModal"), "click", (e) => {
      if (e.target && e.target.id === "imgViewerModal") closeImgViewer();
    });

    on($("[data-viewer-prev]"), "click", () => {
      viewerIndex = Math.max(0, viewerIndex - 1);
      renderViewer();
    });
    on($("[data-viewer-next]"), "click", () => {
      viewerIndex = Math.min(viewerImages.length - 1, viewerIndex + 1);
      renderViewer();
    });

    on($("#imgViewerDots"), "click", (e) => {
      const b = e.target?.closest("button[data-dot]");
      if (!b) return;
      viewerIndex = Number(b.dataset.dot);
      renderViewer();
    });

    // Swipe / drag for viewer
    const viewerViewport = $("#imgViewerModal .viewer-viewport");
    bindSwipeArea(
      viewerViewport,
      () => {
        viewerIndex = Math.max(0, viewerIndex - 1);
        renderViewer();
      },
      () => {
        viewerIndex = Math.min(viewerImages.length - 1, viewerIndex + 1);
        renderViewer();
      },
    );
  }

  /* =========================
    Sizes dropdown
  ========================= */
  function updateSizeLabel() {
    console.log("[updateSizeLabel] Updating size label");
    const label = $("#msLabel");
    if (!label) return;

    const count = $$("#sizeChips .size-chip input:checked").length;
    console.log("[updateSizeLabel] Selected count:", count);
    if (count) {
      label.textContent = `${count} Selected`;
      label.classList.remove("is-idle");
      label.classList.add("is-selected");
    } else {
      label.textContent = "Select Sizes";
      label.classList.remove("is-selected");
      label.classList.add("is-idle");
    }
  }

  function bindSizesDropdown() {
    console.log("[bindSizesDropdown] Binding sizes dropdown");
    // Use specific selector for the sizes dropdown (has data-sizes attribute)
    const wrap = $(".ms-wrapper--form[data-sizes]");
    if (!wrap) {
      console.log("[bindSizesDropdown] No sizes dropdown found");
      return;
    }

    const dd = wrap.querySelector(".ms-dropdown");
    const trig = wrap.querySelector(".ms-trigger");
    if (!dd || !trig) return;

    function openDD() {
      // Close all other form dropdowns first
      $$(".ms-wrapper--form .ms-dropdown").forEach((d) => {
        if (d !== dd) d.hidden = true;
      });
      dd.hidden = false;
      trig.setAttribute("aria-expanded", "true");
    }
    function closeDD() {
      dd.hidden = true;
      trig.setAttribute("aria-expanded", "false");
    }
    function toggleDD() {
      dd.hidden ? openDD() : closeDD();
    }

    trig.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDD();
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) closeDD();
    });

    on(dd, "change", (e) => {
      if (e.target && e.target.hasAttribute("data-ms-all")) {
        $$("#sizeChips .size-chip input").forEach(
          (c) => (c.checked = e.target.checked),
        );
      }

      const selected = $$("#sizeChips .size-chip input:checked").map(
        (cb) => cb.value,
      );
      const hidden = $("#pSizes");
      if (hidden) hidden.value = JSON.stringify(selected);
      updateSizeLabel();
    });

    $$("#sizeChips .size-chip input").forEach((cb) =>
      on(cb, "change", () => {
        const selected = $$("#sizeChips .size-chip input:checked").map(
          (x) => x.value,
        );
        const hidden = $("#pSizes");
        if (hidden) hidden.value = JSON.stringify(selected);
        updateSizeLabel();
      }),
    );
  }

  /* =========================
    Form Select Dropdowns (single-select)
  ========================= */
  function bindFormSelectDropdowns() {
    console.log("[bindFormSelectDropdowns] Binding form select dropdowns");
    // Get all form select dropdowns (with data-field attribute)
    const wrappers = $$("div.ms-wrapper--form[data-field]");
    console.log("[bindFormSelectDropdowns] Found dropdowns:", wrappers.length);

    wrappers.forEach((wrap) => {
      const fieldId = wrap.dataset.field;
      const trig = wrap.querySelector(".ms-trigger");
      const dd = wrap.querySelector(".ms-dropdown");
      const label = wrap.querySelector(".ms-label");
      const hiddenInput = $(`#${fieldId}`);

      if (!trig || !dd || !label) return;

      function openDD() {
        // Close all other form dropdowns first (including sizes)
        $$(".ms-wrapper--form .ms-dropdown").forEach((d) => {
          if (d !== dd) d.hidden = true;
        });
        dd.hidden = false;
      }

      function closeDD() {
        dd.hidden = true;
      }

      function toggleDD() {
        dd.hidden ? openDD() : closeDD();
      }

      function selectItem(value, text) {
        if (hiddenInput) hiddenInput.value = value;
        label.textContent = text;
        label.classList.remove("is-idle");
        label.classList.add("is-selected");
        closeDD();

        // Trigger change event for color mode toggle
        if (fieldId === "pColorMode") {
          toggleColorUI();
        }
      }

      // Trigger click
      trig.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleDD();
      });

      // Item clicks
      dd.querySelectorAll(".ms-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = item.dataset.value;
          const txt = item.textContent.trim();
          selectItem(val, txt);
        });
      });

      // Close on outside click
      document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) closeDD();
      });
    });
  }

  // Helper to update a form dropdown value and label (for edit mode)
  function setFormDropdownValue(fieldId, value) {
    console.log("[setFormDropdownValue] Setting:", fieldId, "=", value);
    const selectEl = $(`#${fieldId}`);

    if (!selectEl) {
      console.log("[setFormDropdownValue] Element not found for:", fieldId);
      return;
    }

    // Handle native <select> elements
    if (selectEl.tagName === "SELECT") {
      selectEl.value = value;
      console.log(
        "[setFormDropdownValue] Native select set to:",
        selectEl.value,
      );
      return;
    }

    // Handle custom dropdown (ms-wrapper--form)
    const wrap = $(`.ms-wrapper--form[data-field="${fieldId}"]`);
    if (!wrap) {
      console.log(
        "[setFormDropdownValue] Custom wrapper not found for:",
        fieldId,
      );
      return;
    }

    selectEl.value = value;
    const label = wrap.querySelector(".ms-label");
    const item = wrap.querySelector(`.ms-item[data-value="${value}"]`);

    if (label && item) {
      label.textContent = item.textContent.trim();
      label.classList.remove("is-idle");
      label.classList.add("is-selected");
    } else if (label) {
      label.textContent = "Select...";
      label.classList.add("is-idle");
      label.classList.remove("is-selected");
    }
  }

  /* =========================
    Color UI
  ========================= */
  function toggleColorUI() {
    console.log("[toggleColorUI] Toggling color UI");
    const modeEl = $("#pColorMode");
    const pack = $("#packTypeWrap");
    const openWrap = $("#openColorsWrap");
    if (!modeEl) return;

    const mode = modeEl.value || "open";
    console.log("[toggleColorUI] Mode:", mode);
    if (pack) pack.hidden = mode !== "assorted";
    if (openWrap) openWrap.hidden = mode === "assorted";
  }

  /* =========================
    Color Stock Management
  ========================= */
  function getColorStockData() {
    try {
      return JSON.parse($("#pColors")?.value || "[]");
    } catch {
      return [];
    }
  }

  function setColorStockData(data) {
    console.log("[setColorStockData] Setting data:", data);
    const input = $("#pColors");
    console.log("[setColorStockData] Hidden input found:", !!input);
    if (input) {
      input.value = JSON.stringify(data);
      console.log("[setColorStockData] Input value set to:", input.value);
    }
    renderColorStockList();
    updateColorCounter();
    rebuildVariantMatrix();
  }

  function renderColorStockList() {
    const list = $("#colorStockList");
    console.log("[renderColorStockList] List element found:", !!list);
    if (!list) return;

    const colors = getColorStockData();
    console.log("[renderColorStockList] Colors to render:", colors);

    if (!colors.length) {
      list.innerHTML =
        '<span class="color-stock-empty">No colors added yet</span>';
      return;
    }

    list.innerHTML = colors
      .map(
        (c, i) => `
      <div class="color-stock-item" data-index="${i}">
        <span class="color-name">${escapeHtml(c.name)}</span>
        <span class="color-qty ${c.qty <= 0 ? "out-of-stock" : ""}">${c.qty}</span>
        <span class="remove-color" title="Remove"><i class="fa-solid fa-times"></i></span>
      </div>
    `,
      )
      .join("");
    console.log(
      "[renderColorStockList] Rendered HTML:",
      list.innerHTML.substring(0, 100),
    );
  }

  function addColorStock() {
    console.log("[addColorStock] Function called");
    const nameInput = $("#pColorName");
    const qtyInput = $("#pColorQty");

    console.log("[addColorStock] Inputs:", {
      nameInput: !!nameInput,
      qtyInput: !!qtyInput,
      nameValue: nameInput?.value,
      qtyValue: qtyInput?.value,
    });

    if (!nameInput || !qtyInput) {
      console.error("[addColorStock] Inputs not found!");
      return;
    }

    const name = nameInput.value.trim();
    const qty = parseInt(qtyInput.value) || 0;

    if (!name) {
      showToast("Please enter a color name");
      nameInput.focus();
      return;
    }

    const colors = getColorStockData();
    console.log("[addColorStock] Current colors:", colors);

    // Check for duplicate
    const existingIndex = colors.findIndex(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (existingIndex >= 0) {
      // Update existing
      colors[existingIndex].qty = qty;
      showToast(`Updated ${name} quantity`);
    } else {
      // Add new
      colors.push({ name, qty });
      console.log("[addColorStock] Added new color:", { name, qty });
    }

    setColorStockData(colors);
    console.log("[addColorStock] Colors after save:", getColorStockData());

    nameInput.value = "";
    qtyInput.value = "0";
    nameInput.focus();
  }

  function removeColorStock(index) {
    const colors = getColorStockData();
    if (index >= 0 && index < colors.length) {
      colors.splice(index, 1);
      setColorStockData(colors);
    }
  }

  function setupColorStockEvents() {
    console.log("[setupColorStockEvents] Setting up color stock events");
    const addBtn = $("#addColorBtn");
    const nameInput = $("#pColorName");
    const qtyInput = $("#pColorQty");
    const colorList = $("#colorStockList");

    console.log("[setupColorStockEvents] Elements found:", {
      addBtn: !!addBtn,
      nameInput: !!nameInput,
      qtyInput: !!qtyInput,
      colorList: !!colorList,
    });

    // Add color button
    if (addBtn) {
      addBtn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("[setupColorStockEvents] Add button clicked");
        addColorStock();
      });
    }

    // Enter key in inputs
    if (nameInput) {
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          console.log("[setupColorStockEvents] Enter in name input");
          addColorStock();
        }
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          console.log("[setupColorStockEvents] Enter in qty input");
          addColorStock();
        }
      });
    }

    // Remove color click
    if (colorList) {
      colorList.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".remove-color");
        if (!removeBtn) return;
        console.log("[setupColorStockEvents] Remove color clicked");
        const item = removeBtn.closest(".color-stock-item");
        const index = parseInt(item?.dataset.index);
        if (!isNaN(index)) removeColorStock(index);
      });
    }
  }

  /* =========================
    Size Stock Management (like colors)
  ========================= */
  function getSizeStockData() {
    const input = $("#pSizes");
    if (!input) return [];
    try {
      const data = JSON.parse(input.value || "[]");
      // Handle both old format (array of strings) and new format (array of objects)
      return data.map((item) => {
        if (typeof item === "string") {
          return { name: item, qty: 0 };
        }
        return item;
      });
    } catch {
      return [];
    }
  }

  function setSizeStockData(data) {
    const input = $("#pSizes");
    if (input) {
      input.value = JSON.stringify(data);
    }
    renderSizeStockList();
    updateSizeCounter();
    rebuildVariantMatrix();
  }

  function updateSizeCounter() {
    const counter = $("#sizeCounter");
    if (!counter) return;
    const count = getSizeStockData().length;
    counter.textContent = count;
    counter.classList.toggle("has-items", count > 0);
  }

  function updateColorCounter() {
    const counter = $("#colorCounter");
    if (!counter) return;
    const count = getColorStockData().length;
    counter.textContent = count;
    counter.classList.toggle("has-items", count > 0);
  }

  function renderSizeStockList() {
    const list = $("#sizeStockList");
    if (!list) return;

    const sizes = getSizeStockData();

    if (!sizes.length) {
      list.innerHTML =
        '<span class="size-stock-empty">No sizes added yet</span>';
      return;
    }

    list.innerHTML = sizes
      .map(
        (s, i) => `
      <div class="size-stock-item" data-index="${i}">
        <span class="size-name">${escapeHtml(s.name)}</span>
        <span class="size-qty ${s.qty <= 0 ? "out-of-stock" : ""}">${s.qty}</span>
        <span class="remove-size" title="Remove"><i class="fa-solid fa-times"></i></span>
      </div>
    `,
      )
      .join("");
  }

  function addSizeStock() {
    const nameSelect = $("#pSizeName");
    const qtyInput = $("#pSizeQty");

    if (!nameSelect || !qtyInput) return;

    const name = nameSelect.value.trim();
    const qty = parseInt(qtyInput.value) || 0;

    if (!name) {
      showToast("Please select a size");
      nameSelect.focus();
      return;
    }

    const sizes = getSizeStockData();

    // Check for duplicate
    const existingIndex = sizes.findIndex(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );
    if (existingIndex >= 0) {
      // Update existing
      sizes[existingIndex].qty = qty;
      showToast(`Updated ${name} quantity`);
    } else {
      // Add new
      sizes.push({ name, qty });
      showToast(`Added ${name}`);
    }

    setSizeStockData(sizes);

    nameSelect.value = "";
    qtyInput.value = "0";
    nameSelect.focus();
  }

  function removeSizeStock(index) {
    const sizes = getSizeStockData();
    if (index >= 0 && index < sizes.length) {
      sizes.splice(index, 1);
      setSizeStockData(sizes);
    }
  }

  function setupSizeStockEvents() {
    // Setup unified variant input instead of separate size/color inputs
    setupUnifiedVariantEvents();

    // Initial render
    renderVariantList();
  }

  /* =========================
    Variant Stock Matrix (Size + Color combinations)
  ========================= */
  function getVariantStockData() {
    const input = $("#pVariantStock");
    if (!input) return [];
    try {
      return JSON.parse(input.value || "[]");
    } catch {
      return [];
    }
  }

  function setVariantStockData(data) {
    const input = $("#pVariantStock");
    if (input) {
      input.value = JSON.stringify(data);
    }
    updateVariantCounter();
  }

  function updateVariantCounter() {
    const counter = $("#variantCounter");
    if (!counter) return;
    const data = getVariantStockData();
    const totalStock = data.reduce((sum, v) => sum + (v.qty || 0), 0);
    counter.textContent = totalStock;
    counter.classList.toggle("has-items", totalStock > 0);
  }

  function updateVariantMatrix() {
    const wrapper = $("#variantMatrixWrap");
    const matrixEl = $("#variantMatrix");
    if (!wrapper || !matrixEl) return;

    const sizes = getSizeStockData();
    const colors = getColorStockData();
    const colorMode = $("#pColorMode")?.value || "";

    // Only show matrix if both sizes and colors exist AND color mode is "open"
    const shouldShow =
      sizes.length > 0 && colors.length > 0 && colorMode === "open";
    wrapper.hidden = !shouldShow;

    if (!shouldShow) {
      matrixEl.innerHTML = "";
      return;
    }

    // Get existing variant data
    const existingData = getVariantStockData();
    const dataMap = {};
    existingData.forEach((v) => {
      dataMap[`${v.size}-${v.color}`] = v.qty || 0;
    });

    // Build the matrix table
    let html = `
      <table>
        <thead>
          <tr>
            <th>Size / Color</th>
            ${colors.map((c) => `<th>${escapeHtml(c.name)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
    `;

    sizes.forEach((size) => {
      html += `<tr><td>${escapeHtml(size.name)}</td>`;
      colors.forEach((color) => {
        const key = `${size.name}-${color.name}`;
        const qty = dataMap[key] ?? 0;
        html += `
          <td>
            <input type="number" 
              class="variant-qty-input ${qty <= 0 ? "out-of-stock" : ""}"
              data-size="${escapeHtml(size.name)}"
              data-color="${escapeHtml(color.name)}"
              value="${qty}"
              min="0"
            />
          </td>
        `;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    matrixEl.innerHTML = html;

    // Bind input change events
    matrixEl.querySelectorAll(".variant-qty-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        onVariantQtyChange(e);
        renderVariantSummary();
      });
      input.addEventListener("input", (e) => {
        const val = parseInt(e.target.value) || 0;
        e.target.classList.toggle("out-of-stock", val <= 0);
      });
    });

    // Render summary
    renderVariantSummary();
  }

  // Color name to hex mapping for summary display
  const adminColorMap = {
    blue: "#2563eb",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#eab308",
    orange: "#f97316",
    purple: "#9333ea",
    pink: "#ec4899",
    black: "#1f2937",
    white: "#ffffff",
    grey: "#6b7280",
    gray: "#6b7280",
    brown: "#92400e",
    navy: "#1e3a8a",
    beige: "#d4a574",
    maroon: "#7f1d1d",
    teal: "#0d9488",
    gold: "#ca8a04",
    silver: "#94a3b8",
    cream: "#fef3c7",
    coral: "#f87171",
    lavender: "#c4b5fd",
    peach: "#fdba74",
    nude: "#e8d4c4",
    ivory: "#fffff0",
    burgundy: "#881337",
    mint: "#86efac",
    rose: "#fda4af",
    wine: "#7c2d12",
    chocolate: "#78350f",
    tan: "#d97706",
    camel: "#b45309",
  };

  function getAdminColorHex(colorName) {
    const lower = String(colorName || "")
      .toLowerCase()
      .trim();
    return adminColorMap[lower] || colorName || "#ccc";
  }

  function renderVariantSummary() {
    const summaryEl = $("#variantSummary");
    if (!summaryEl) return;

    const data = getVariantStockData();

    // Filter only items with qty > 0 for the summary, or show all if none have stock
    const itemsWithStock = data.filter((v) => v.qty > 0);
    const displayData = itemsWithStock.length > 0 ? itemsWithStock : data;

    if (!displayData.length) {
      summaryEl.innerHTML = "";
      return;
    }

    // Sort by size order, then color
    const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "One Size"];
    displayData.sort((a, b) => {
      const aIdx = sizeOrder.indexOf(a.size);
      const bIdx = sizeOrder.indexOf(b.size);
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.color.localeCompare(b.color);
    });

    let html = `<span class="variant-summary-title">Stock Summary</span>`;

    displayData.forEach((v) => {
      const qtyClass =
        v.qty <= 0 ? "out-of-stock" : v.qty <= 5 ? "low-stock" : "";
      const colorHex = getAdminColorHex(v.color);

      html += `
        <div class="variant-chip">
          <span class="chip-size">${escapeHtml(v.size)}</span>
          <span class="chip-color">
            <span class="chip-color-dot" style="background:${colorHex}"></span>
            ${escapeHtml(v.color)}
          </span>
          <span class="chip-qty ${qtyClass}">${v.qty}</span>
        </div>
      `;
    });

    summaryEl.innerHTML = html;
  }

  function onVariantQtyChange(e) {
    const input = e.target;
    const size = input.dataset.size;
    const color = input.dataset.color;
    const qty = parseInt(input.value) || 0;

    const data = getVariantStockData();
    const key = `${size}-${color}`;

    // Find or create entry
    const existingIndex = data.findIndex(
      (v) => v.size === size && v.color === color,
    );
    if (existingIndex >= 0) {
      data[existingIndex].qty = qty;
    } else {
      data.push({ size, color, qty });
    }

    setVariantStockData(data);
  }

  function rebuildVariantMatrix() {
    // Called when sizes or colors change - rebuild matrix preserving existing values
    const sizes = getSizeStockData();
    const colors = getColorStockData();
    const oldData = getVariantStockData();

    // Create new data array with only valid size-color combinations
    const newData = [];
    sizes.forEach((size) => {
      colors.forEach((color) => {
        const existing = oldData.find(
          (v) => v.size === size.name && v.color === color.name,
        );
        newData.push({
          size: size.name,
          color: color.name,
          qty: existing?.qty || 0,
        });
      });
    });

    setVariantStockData(newData);
    renderVariantList();
  }

  /* =========================
    Unified Variant Input System
  ========================= */
  function addVariant() {
    const sizeSelect = $("#pVariantSize");
    const colorInput = $("#pVariantColor");
    const qtyInput = $("#pVariantQty");

    if (!sizeSelect || !colorInput || !qtyInput) return;

    const size = sizeSelect.value.trim();
    const color = colorInput.value.trim();
    const qty = parseInt(qtyInput.value) || 0;

    if (!size) {
      showToast("Please select a size", "error");
      sizeSelect.focus();
      return;
    }

    if (!color) {
      showToast("Please enter a color", "error");
      colorInput.focus();
      return;
    }

    if (qty < 0) {
      showToast("Quantity must be 0 or more", "error");
      qtyInput.focus();
      return;
    }

    const variants = getVariantStockData();

    // Check for duplicate
    const existingIndex = variants.findIndex(
      (v) =>
        v.size.toLowerCase() === size.toLowerCase() &&
        v.color.toLowerCase() === color.toLowerCase(),
    );

    if (existingIndex >= 0) {
      // Update existing
      variants[existingIndex].qty = qty;
      showToast(`Updated ${size} ${color} to ${qty} units`);
    } else {
      // Add new
      variants.push({ size, color, qty });
      showToast(`Added ${qty} × ${size} ${color}`);
    }

    setVariantStockData(variants);
    updateSizesFromVariants();
    updateColorsFromVariants();
    renderVariantList();

    // Clear inputs for next entry
    colorInput.value = "";
    qtyInput.value = "";
    colorInput.focus();
  }

  function removeVariant(index) {
    const variants = getVariantStockData();
    if (index >= 0 && index < variants.length) {
      const removed = variants[index];
      variants.splice(index, 1);
      setVariantStockData(variants);
      updateSizesFromVariants();
      updateColorsFromVariants();
      renderVariantList();
      showToast(`Removed ${removed.size} ${removed.color}`);
    }
  }

  function updateVariantQty(index, newQty) {
    const variants = getVariantStockData();
    if (index >= 0 && index < variants.length) {
      variants[index].qty = Math.max(0, parseInt(newQty) || 0);
      setVariantStockData(variants);
      renderVariantList();
    }
  }

  // Extract unique sizes from variants and update pSizes
  function updateSizesFromVariants() {
    const variants = getVariantStockData();
    const sizeMap = {};

    variants.forEach((v) => {
      if (!sizeMap[v.size]) {
        sizeMap[v.size] = 0;
      }
      sizeMap[v.size] += v.qty || 0;
    });

    const sizes = Object.entries(sizeMap).map(([name, qty]) => ({ name, qty }));

    const input = $("#pSizes");
    if (input) {
      input.value = JSON.stringify(sizes);
    }
  }

  // Extract unique colors from variants and update pColors
  function updateColorsFromVariants() {
    const variants = getVariantStockData();
    const colorMap = {};

    variants.forEach((v) => {
      if (!colorMap[v.color]) {
        colorMap[v.color] = 0;
      }
      colorMap[v.color] += v.qty || 0;
    });

    const colors = Object.entries(colorMap).map(([name, qty]) => ({
      name,
      qty,
    }));

    const input = $("#pColors");
    if (input) {
      input.value = JSON.stringify(colors);
    }
  }

  function renderVariantList() {
    const list = $("#variantList");
    if (!list) return;

    const variants = getVariantStockData();
    updateVariantCounter();

    if (!variants.length) {
      list.innerHTML = `
        <div class="variant-list-empty">
          <i class="fa-solid fa-box-open"></i>
          <p>No variants added yet</p>
          <span>Add size, color and quantity above</span>
        </div>
      `;
      return;
    }

    // Group by size for better display
    const sizeGroups = {};
    variants.forEach((v, i) => {
      if (!sizeGroups[v.size]) {
        sizeGroups[v.size] = [];
      }
      sizeGroups[v.size].push({ ...v, index: i });
    });

    const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "One Size"];
    const sortedSizes = Object.keys(sizeGroups).sort((a, b) => {
      const aIdx = sizeOrder.indexOf(a);
      const bIdx = sizeOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    let html = "";
    sortedSizes.forEach((size) => {
      html += `<div class="variant-group">
        <div class="variant-group-header">
          <span class="variant-group-size">${escapeHtml(size)}</span>
          <span class="variant-group-count">${sizeGroups[size].length} color${sizeGroups[size].length > 1 ? "s" : ""}</span>
        </div>
        <div class="variant-group-items">`;

      sizeGroups[size].forEach((v) => {
        const colorHex = getAdminColorHex(v.color);
        const isLowStock = v.qty > 0 && v.qty <= 5;
        const isOutOfStock = v.qty <= 0;

        html += `
          <div class="variant-item ${isOutOfStock ? "out-of-stock" : ""} ${isLowStock ? "low-stock" : ""}" data-index="${v.index}">
            <span class="variant-color-dot" style="background: ${colorHex}"></span>
            <span class="variant-color-name">${escapeHtml(v.color)}</span>
            <div class="variant-qty-control">
              <button type="button" class="qty-btn" data-action="dec">−</button>
              <input type="number" class="variant-qty-input" value="${v.qty}" min="0" />
              <button type="button" class="qty-btn" data-action="inc">+</button>
            </div>
            <button type="button" class="variant-remove" title="Remove">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
      });

      html += `</div></div>`;
    });

    // Add total summary
    const totalQty = variants.reduce((sum, v) => sum + (v.qty || 0), 0);
    const totalVariants = variants.length;
    html += `
      <div class="variant-summary-bar">
        <span><strong>${totalVariants}</strong> variant${totalVariants > 1 ? "s" : ""}</span>
        <span><strong>${totalQty}</strong> total units</span>
      </div>
    `;

    list.innerHTML = html;
  }

  function setupUnifiedVariantEvents() {
    const addBtn = $("#addVariantBtn");
    const sizeSelect = $("#pVariantSize");
    const colorInput = $("#pVariantColor");
    const qtyInput = $("#pVariantQty");
    const variantList = $("#variantList");
    const quickBtns = document.querySelectorAll(".quick-size-btn");

    // Add variant button
    if (addBtn) {
      addBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addVariant();
      });
    }

    // Enter key in inputs
    [colorInput, qtyInput].forEach((input) => {
      if (input) {
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addVariant();
          }
        });
      }
    });

    // Quick size buttons
    quickBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const size = btn.dataset.size;
        if (sizeSelect) {
          sizeSelect.value = size;
          colorInput?.focus();
        }
      });
    });

    // Variant list actions (remove, qty change)
    if (variantList) {
      variantList.addEventListener("click", (e) => {
        const item = e.target.closest(".variant-item");
        if (!item) return;
        const index = parseInt(item.dataset.index);

        // Remove button
        if (e.target.closest(".variant-remove")) {
          removeVariant(index);
          return;
        }

        // Qty buttons
        const qtyBtn = e.target.closest(".qty-btn");
        if (qtyBtn) {
          const input = item.querySelector(".variant-qty-input");
          const currentQty = parseInt(input?.value) || 0;
          const delta = qtyBtn.dataset.action === "inc" ? 1 : -1;
          updateVariantQty(index, currentQty + delta);
        }
      });

      // Qty input change
      variantList.addEventListener("change", (e) => {
        if (e.target.classList.contains("variant-qty-input")) {
          const item = e.target.closest(".variant-item");
          if (item) {
            const index = parseInt(item.dataset.index);
            updateVariantQty(index, e.target.value);
          }
        }
      });
    }

    // Initial render
    renderVariantList();
  }

  /* =========================
    Image Preview Modal
  ========================= */
  function openImagePreviewModal(src) {
    // Check if modal exists, create if not
    let modal = $("#imagePreviewModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "imagePreviewModal";
      modal.className = "image-preview-modal";
      modal.innerHTML = `
        <div class="image-preview-backdrop"></div>
        <div class="image-preview-content">
          <button type="button" class="image-preview-close" aria-label="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <img src="" alt="Preview" class="image-preview-img" />
        </div>
      `;
      document.body.appendChild(modal);

      // Bind close events
      modal
        .querySelector(".image-preview-backdrop")
        .addEventListener("click", closeImagePreviewModal);
      modal
        .querySelector(".image-preview-close")
        .addEventListener("click", closeImagePreviewModal);
      modal.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeImagePreviewModal();
      });
    }

    modal.querySelector(".image-preview-img").src = src;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeImagePreviewModal() {
    const modal = $("#imagePreviewModal");
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  /* =========================
    Studio slider
  ========================= */
  let studioIndex = 0;
  let studioExisting = [];
  let studioAdded = [];

  function rebuildInputFiles() {
    console.log(
      "[rebuildInputFiles] Rebuilding input files, count:",
      studioAdded.length,
    );
    const input = $("#pImageFiles");
    if (!input) return;

    const dt = new DataTransfer();
    studioAdded.forEach((it) => dt.items.add(it.file));
    input.files = dt.files;
  }

  function renderStudioSlider() {
    console.log("[renderStudioSlider] Rendering studio slider");
    const slider = $("#studioImgSlider");
    const track = $("#studioImgTrack");
    const dots = $("#studioImgDots");
    if (!slider || !track || !dots) return;

    const all = [
      ...studioExisting.map((u) => ({ type: "existing", src: u })),
      ...studioAdded.map((o) => ({ type: "added", src: o.url })),
    ];
    console.log("[renderStudioSlider] Total images:", all.length);

    if (!all.length) {
      slider.hidden = true;
      dots.hidden = true;
      track.innerHTML = "";
      return;
    }

    slider.hidden = false;

    track.innerHTML = all
      .map((it, i) => {
        return `
        <div class="slide">
          <img src="${it.src}" alt="Product image ${i + 1}">
          <button type="button" class="slide-remove" data-remove="${i}" aria-label="Remove image">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      `;
      })
      .join("");

    studioIndex = Math.max(0, Math.min(studioIndex, all.length - 1));
    track.style.transform = `translateX(-${studioIndex * 100}%)`;

    if (all.length > 1) {
      dots.hidden = false;
      dots.innerHTML = all
        .map(
          (_, i) =>
            `<button type="button" class="${i === studioIndex ? "active" : ""}" data-studiodot="${i}" aria-label="Go to ${i + 1}"></button>`,
        )
        .join("");
    } else {
      dots.hidden = true;
      dots.innerHTML = "";
    }

    const prev = $("[data-studio-prev]");
    const next = $("[data-studio-next]");
    if (prev) prev.disabled = all.length <= 1 || studioIndex === 0;
    if (next) next.disabled = all.length <= 1 || studioIndex === all.length - 1;
  }

  function bindStudioSlider() {
    console.log("[bindStudioSlider] Binding studio slider");
    const input = $("#pImageFiles");
    if (!input) return;

    on(input, "change", () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;

      files.forEach((file) => {
        const url = URL.createObjectURL(file);
        studioAdded.push({ file, url });
      });

      input.value = "";
      rebuildInputFiles();

      studioIndex = 0;
      renderStudioSlider();
    });

    on($("[data-studio-prev]"), "click", () => {
      studioIndex = Math.max(0, studioIndex - 1);
      renderStudioSlider();
    });

    on($("[data-studio-next]"), "click", () => {
      const total = studioExisting.length + studioAdded.length;
      studioIndex = Math.min(total - 1, studioIndex + 1);
      renderStudioSlider();
    });

    on($("#studioImgDots"), "click", (e) => {
      const b = e.target?.closest("button[data-studiodot]");
      if (!b) return;
      studioIndex = Number(b.dataset.studiodot);
      renderStudioSlider();
    });

    on($("#studioImgTrack"), "click", (e) => {
      const btn = e.target?.closest("button[data-remove]");
      if (!btn) return;

      const idx = Number(btn.dataset.remove);
      const existingCount = studioExisting.length;

      if (idx < existingCount) {
        studioExisting.splice(idx, 1);
      } else {
        const addedIdx = idx - existingCount;
        const removed = studioAdded.splice(addedIdx, 1)[0];
        if (removed?.url) URL.revokeObjectURL(removed.url);
        rebuildInputFiles();
      }

      studioIndex = Math.max(
        0,
        Math.min(studioIndex, studioExisting.length + studioAdded.length - 1),
      );
      renderStudioSlider();
    });

    // Double-click to preview image in full screen
    on($("#studioImgTrack"), "dblclick", (e) => {
      const img = e.target?.closest("img");
      if (!img) return;
      openImagePreviewModal(img.src);
    });

    // Swipe / drag for studio
    const studioViewport = $("#studioImgSlider .slider-viewport");
    bindSwipeArea(
      studioViewport,
      () => {
        studioIndex = Math.max(0, studioIndex - 1);
        renderStudioSlider();
      },
      () => {
        const total = studioExisting.length + studioAdded.length;
        studioIndex = Math.min(total - 1, studioIndex + 1);
        renderStudioSlider();
      },
    );
  }

  /* =========================
    Add/Edit mode (Save/Delete)
  ========================= */
  function setStudioMode(isEditing) {
    console.log("[setStudioMode] Setting mode, isEditing:", isEditing);
    // isEditing=true => Save left + Delete shown
    // isEditing=false => Save right + Delete hidden
    document.body.classList.toggle("is-add-mode", !isEditing);

    const delBtn = $("#deleteBtn");
    if (delBtn) delBtn.hidden = !isEditing;
  }

  /* =========================
    Reset / Edit / Delete
  ========================= */
  function resetForm() {
    console.log("[resetForm] Resetting product form");
    const form = $("#productForm");
    if (!form) return;

    form.reset();
    $("#productId").value = "";

    const title = $("#formTitle");
    if (title) title.textContent = "Add New Product";

    const delBtn = $("#deleteBtn");
    if (delBtn) delBtn.hidden = true;

    // Reset sizes (now using stock list like colors)
    setSizeStockData([]);

    // Reset all form select dropdowns (native selects)
    [
      "pCategory",
      "pGender",
      "pDeliveryType",
      "pColorMode",
      "pPackType",
      "pSizeName",
    ].forEach((fieldId) => {
      const selectEl = $(`#${fieldId}`);
      if (selectEl) {
        selectEl.value = "";
      }
    });

    toggleColorUI();

    // Reset color stock
    setColorStockData([]);

    // Reset variant stock
    setVariantStockData([]);
    renderVariantList();

    studioExisting = [];
    studioAdded.forEach((x) => x?.url && URL.revokeObjectURL(x.url));
    studioAdded = [];
    studioIndex = 0;
    rebuildInputFiles();
    renderStudioSlider();

    setStudioMode(false);
  }

  async function startEdit(id) {
    console.log("[startEdit] Loading product for edit:", id);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      console.error("[startEdit] Error:", error);
      showToast("Failed to load product");
      return;
    }
    if (!data) return;
    console.log("[startEdit] Product loaded:", data.name);

    switchView("studio");

    const formTitle = $("#formTitle");
    if (formTitle)
      formTitle.textContent = "Editing " + (data.name || "Product");

    const setVal = (sel, val) => {
      const el = $(sel);
      if (el) el.value = val ?? "";
    };

    setVal("#productId", data.id);
    setVal("#pName", data.name);
    setVal("#pDescription", data.description || "");
    setVal("#pPrice", data.price_ngn ?? 0);
    setVal("#pQty", data.qty ?? 0);

    // Use setFormDropdownValue for custom dropdowns
    setFormDropdownValue("pCategory", data.category || "");
    setFormDropdownValue("pGender", data.gender || "");
    setFormDropdownValue("pDeliveryType", data.delivery_type || "standard");

    // Handle sizes - support both old format (string array) and new format (object array)
    const sizesRaw = data.sizes || [];
    console.log(
      "[startEdit] Raw sizes from DB:",
      sizesRaw,
      "Type:",
      typeof sizesRaw,
    );
    let sizesData = [];
    if (sizesRaw.length > 0) {
      if (typeof sizesRaw[0] === "string") {
        // Old format: ["S", "M", "L"] -> convert to new format
        sizesData = sizesRaw.map((name) => ({ name, qty: 0 }));
        console.log("[startEdit] Converted sizes from old format:", sizesData);
      } else {
        // New format: [{name: "M", qty: 10}]
        sizesData = sizesRaw;
        console.log("[startEdit] Using new sizes format:", sizesData);
      }
    }
    setSizeStockData(sizesData);

    // Color mode and pack type with custom dropdowns
    const colorModeValue = data.allow_color_selection ? "open" : "assorted";
    setFormDropdownValue("pColorMode", colorModeValue);
    toggleColorUI();

    setFormDropdownValue("pPackType", data.pack_type || "2-in-1");

    // Handle colors - support both old format (string array) and new format (object array)
    const colorsRaw = data.colors || [];
    console.log(
      "[startEdit] Raw colors from DB:",
      colorsRaw,
      "Type:",
      typeof colorsRaw,
    );
    let colorsData = [];
    if (colorsRaw.length > 0) {
      if (typeof colorsRaw[0] === "string") {
        // Old format: ["Red", "Blue"] -> convert to new format
        colorsData = colorsRaw.map((name) => ({ name, qty: 1 }));
        console.log("[startEdit] Converted from old format:", colorsData);
      } else {
        // New format: [{name: "Red", qty: 10}]
        colorsData = colorsRaw;
        console.log("[startEdit] Using new format:", colorsData);
      }
    }
    console.log("[startEdit] Setting colors:", colorsData);
    setColorStockData(colorsData);

    // Load variant stock data
    const variantStockData = data.variant_stock || [];
    setVariantStockData(variantStockData);
    renderVariantList();

    $("#pIsActive").checked = !!data.is_active;
    $("#pIsNew").checked = !!data.is_new;

    setStudioMode(true);

    studioExisting = Array.isArray(data.images) ? [...data.images] : [];
    studioAdded.forEach((x) => x?.url && URL.revokeObjectURL(x.url));
    studioAdded = [];
    studioIndex = 0;
    rebuildInputFiles();
    renderStudioSlider();
  }

  /* =========================
    Invite modal
  ========================= */
  function openInviteModal() {
    console.log("[openInviteModal] Opening invite modal");
    const modal = $("#inviteAdminModal");
    if (!modal) return;
    modal.hidden = false;
    $("#inviteAdminEmail")?.focus();
  }

  function closeInviteModal() {
    console.log("[closeInviteModal] Closing invite modal");
    const modal = $("#inviteAdminModal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    const email = $("#inviteAdminEmail");
    if (email) email.value = "";
  }

  function isValidEmail(email) {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
    console.log("[isValidEmail] Email:", email, "Valid:", valid);
    return valid;
  }

  function bindInviteModal() {
    console.log("[bindInviteModal] Binding invite modal");
    on($("#openInviteModalBtn"), "click", openInviteModal);
    on($("[data-close-invite]"), "click", closeInviteModal);

    on($("#inviteAdminModal"), "click", (e) => {
      if (e.target && e.target.id === "inviteAdminModal") closeInviteModal();
    });

    on($("#inviteAdminForm"), "submit", async (e) => {
      e.preventDefault();

      const raw = ($("#inviteAdminEmail")?.value || "").trim();
      const email = raw.toLowerCase();

      if (!email) return showToast("Enter an email.");
      if (!isValidEmail(email))
        return showToast("Enter a valid email address.");

      const btn = $("#inviteAdminForm button[type='submit']");
      setBtnLoading(btn, true, "Sending...");

      try {
        const { error: allowErr } = await supabase
          .from("admin_invites")
          .upsert({ email }, { onConflict: "email" });
        if (allowErr) throw allowErr;

        // Log activity
        await logActivity("invite", "user", null, { email });

        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        });

        if (otpErr) {
          console.warn("OTP send failed (allowlist saved):", otpErr);
          showToast(
            "Invite saved. Ask them to sign up/login with that email (OTP failed).",
          );
          closeInviteModal();
          return;
        }

        showToast(
          "Invite sent. When they login with that email they will become admin.",
        );
        closeInviteModal();
      } catch (err) {
        showToast("Invite failed: " + explainError(err));
      } finally {
        setBtnLoading(btn, false);
      }
    });
  }

  /* =========================
    Dashboard Stats & Widgets
  ========================= */
  async function loadDashboardStats() {
    console.log("[loadDashboardStats] Loading dashboard stats");

    // Load products count
    const { count: productsCount, error: productsErr } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false);

    if (!productsErr) {
      const el = $("#totalProductsCount");
      if (el) el.textContent = productsCount || 0;
    }

    // Load orders data
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("*");

    if (!ordersErr && orders) {
      const totalOrders = orders.length;
      const pendingOrders = orders.filter((o) => o.status === "pending").length;
      const totalRevenue = orders
        .filter((o) => o.status === "delivered")
        .reduce((sum, o) => sum + (o.total || 0), 0);

      const ordersEl = $("#totalOrdersCount");
      const pendingEl = $("#dashPendingCount");
      const revenueEl = $("#totalRevenueAmount");

      if (ordersEl) ordersEl.textContent = totalOrders;
      if (pendingEl) pendingEl.textContent = pendingOrders;
      if (revenueEl)
        revenueEl.textContent = "₦" + totalRevenue.toLocaleString("en-NG");

      // Update pending orders badge in nav
      const badge = $("#pendingOrdersBadge");
      if (badge) {
        badge.textContent = pendingOrders;
        badge.hidden = pendingOrders === 0;
      }
    }

    // Load recent orders for widget
    await loadRecentOrdersWidget();

    // Load low stock for widget
    await loadLowStockWidget();
  }

  async function loadRecentOrdersWidget() {
    const list = $("#recentOrdersList");
    if (!list) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-circle-exclamation"></i>
          <p>Failed to load orders</p>
        </div>`;
      return;
    }

    if (!data || data.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-shopping-bag"></i>
          <p>No orders yet</p>
        </div>`;
      return;
    }

    list.innerHTML = data
      .map((order) => {
        const date = new Date(order.created_at).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
        });
        const statusClass =
          {
            pending: "warning",
            processing: "info",
            shipped: "primary",
            delivered: "success",
            cancelled: "danger",
          }[order.status] || "muted";

        return `
        <div class="widget-item">
          <div class="widget-item-icon">
            <i class="fa-solid fa-shopping-bag"></i>
          </div>
          <div class="widget-item-info">
            <span class="widget-item-title">#${order.id.slice(0, 8)}</span>
            <span class="widget-item-meta">${date} • ${order.customer_name || "Customer"}</span>
          </div>
          <span class="status-badge ${statusClass}">${order.status}</span>
        </div>`;
      })
      .join("");
  }

  async function loadLowStockWidget() {
    const list = $("#lowStockList");
    if (!list) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_deleted", false)
      .lt("stock", 10)
      .order("stock", { ascending: true })
      .limit(5);

    if (error) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-circle-exclamation"></i>
          <p>Failed to load stock data</p>
        </div>`;
      return;
    }

    if (!data || data.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-box-open"></i>
          <p>All products in stock</p>
        </div>`;
      return;
    }

    list.innerHTML = data
      .map((product) => {
        const stockClass =
          product.stock <= 0
            ? "danger"
            : product.stock < 5
              ? "warning"
              : "info";
        return `
        <div class="widget-item">
          <div class="widget-item-icon ${stockClass}">
            <i class="fa-solid fa-cube"></i>
          </div>
          <div class="widget-item-info">
            <span class="widget-item-title">${product.name}</span>
            <span class="widget-item-meta">SKU: ${product.sku || "N/A"}</span>
          </div>
          <span class="stock-count ${stockClass}">${product.stock} left</span>
        </div>`;
      })
      .join("");
  }

  async function loadRecentActivityWidget() {
    const list = $("#recentActivityList");
    if (!list) return;

    const { data, error } = await supabase
      .from("admin_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-circle-exclamation"></i>
          <p>Failed to load activity</p>
        </div>`;
      return;
    }

    if (!data || data.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <p>No recent activity</p>
        </div>`;
      return;
    }

    list.innerHTML = data
      .map((log) => {
        const date = new Date(log.created_at).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        const icon =
          {
            create: "fa-plus",
            update: "fa-pen",
            delete: "fa-trash",
            login: "fa-right-to-bracket",
            logout: "fa-right-from-bracket",
            restore: "fa-rotate-left",
          }[log.action] || "fa-circle";

        return `
        <div class="widget-item">
          <div class="widget-item-icon">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div class="widget-item-info">
            <span class="widget-item-title">${log.action} ${log.entity_type || ""}</span>
            <span class="widget-item-meta">${date}</span>
          </div>
        </div>`;
      })
      .join("");
  }

  /* =========================
    Enter dashboard
  ========================= */
  async function enterDashboard(session) {
    console.log(
      "[enterDashboard] Entering dashboard for user:",
      session?.user?.email,
    );
    $("[data-auth-view]") && ($("[data-auth-view]").hidden = true);
    $("[data-admin-view]") && ($("[data-admin-view]").hidden = false);

    const status = $("#adminStatusText");
    if (status) status.textContent = getSessionDisplayName(session);

    // Store current user info
    currentUserId = session?.user?.id || null;

    // Fetch and apply user role
    if (currentUserId) {
      currentUserRole = await fetchUserRole(currentUserId);
    } else {
      currentUserRole = null;
    }
    applyRoleBasedUI();

    // Update sidebar user info with actual name and role
    updateSidebarUserInfo(session);

    // Start session timeout timer
    resetSessionTimer();

    // Log login activity
    await logActivity("login", "session", currentUserId, {
      admin_name: getSessionDisplayName(session),
    });

    await ensureProfileComplete(session);
    ensureDefaultDashboardView();
    await loadInventory();
    await loadDashboardStats();
  }

  async function gateWithSession(session, source) {
    console.log("[gateWithSession] Source:", source, "Session:", !!session);
    try {
      if (!session) {
        console.log("[gateWithSession] No session, showing auth view");
        $("[data-admin-view]") && ($("[data-admin-view]").hidden = true);
        $("[data-auth-view]") && ($("[data-auth-view]").hidden = false);
        showAuthView("login");
        return;
      }

      const res = await isAdminRPC();
      if (!res.ok || !res.value) {
        console.log("[gateWithSession] Access denied, not admin");
        if (source === "auto") {
          await supabase.auth.signOut();
          showAuthView("login");
          showToast("Access denied.");
          return;
        }
        setAuthMsg("Access denied.");
        await supabase.auth.signOut();
        return;
      }
      console.log("[gateWithSession] Access granted, entering dashboard");

      // Show welcome screen for login (not auto-restore)
      if (source === "login") {
        await showWelcomeScreen(session);
      }

      await enterDashboard(session);
    } catch (err) {
      console.error("[gateWithSession] Exception:", err);
      await supabase.auth.signOut();
      showAuthView("login");
      showToast("Session expired. Please login again.");
    }
  }

  // Show welcome animation after successful login
  async function showWelcomeScreen(session) {
    const overlay = $("#welcomeOverlay");
    const nameEl = $("#welcomeName");
    const avatarEl = $("#welcomeAvatar");

    if (!overlay) return;

    // Get user display name
    let displayName = "Admin";
    try {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .single();
      if (data?.display_name) {
        displayName = data.display_name;
      } else if (session.user.user_metadata?.full_name) {
        displayName = session.user.user_metadata.full_name;
      } else if (session.user.email) {
        displayName = session.user.email.split("@")[0];
      }
    } catch (e) {
      // Fallback to metadata or email
      if (session.user.user_metadata?.full_name) {
        displayName = session.user.user_metadata.full_name;
      } else if (session.user.email) {
        displayName = session.user.email.split("@")[0];
      }
      console.log("Could not fetch display name, using fallback");
    }

    // Set the name
    if (nameEl) {
      nameEl.textContent = displayName;
    }

    // Set avatar initials
    if (avatarEl) {
      const initials = displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
      avatarEl.textContent = initials || "A";
    }

    // Show the welcome overlay
    overlay.hidden = false;

    // Wait for animation to complete then fade out
    await new Promise((resolve) => setTimeout(resolve, 1800));

    overlay.classList.add("fade-out");

    // Remove after fade out
    await new Promise((resolve) => setTimeout(resolve, 400));
    overlay.hidden = true;
    overlay.classList.remove("fade-out");
  }

  async function autoGateOnce() {
    console.log("[autoGateOnce] Checking existing session");
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[autoGateOnce] getSession error:", error);
      showAuthView("login");
      return;
    }
    console.log("[autoGateOnce] Session found:", !!data?.session);
    await gateWithSession(data?.session || null, "auto");
  }

  /* =========================
    Validation
  ========================= */
  const requiredMsg = (label) => `${label} required`;

  function validateLogin() {
    console.log("[validateLogin] Validating login form");
    const email = $("#loginEmail")?.value.trim() || "";
    const pass = $("#loginPassword")?.value || "";
    if (!email && !pass) return "Kindly input your login details.";
    if (!email) return requiredMsg("Email");
    if (!pass) return requiredMsg("Password");
    console.log("[validateLogin] Validation passed");
    return null;
  }

  function validateSignup() {
    console.log("[validateSignup] Validating signup form");
    const first = $("#firstName")?.value.trim() || "";
    const last = $("#lastName")?.value.trim() || "";
    const email = $("#signupEmail")?.value.trim() || "";
    const p1 = $("#signupPassword")?.value || "";
    const p2 = $("#signupPassword2")?.value || "";

    if (!first && !last && !email && !p1 && !p2)
      return "Fill the form to sign up.";
    if (!first) return requiredMsg("First name");
    if (!last) return requiredMsg("Last name");
    if (!email) return requiredMsg("Email");
    if (!p1) return requiredMsg("Password");
    if (!p2) return requiredMsg("Confirm password");
    if (p1 !== p2) return "Passwords do not match.";
    console.log("[validateSignup] Validation passed");
    return null;
  }

  function validateReset() {
    console.log("[validateReset] Validating reset form");
    const email = $("#resetEmail")?.value.trim() || "";
    if (!email) return requiredMsg("Email");
    console.log("[validateReset] Validation passed");
    return null;
  }

  function validateSetPw() {
    console.log("[validateSetPw] Validating set password form");
    const p1 = $("#newPassword")?.value || "";
    const p2 = $("#newPassword2")?.value || "";
    if (!p1) return requiredMsg("New password");
    if (!p2) return requiredMsg("Confirm password");
    if (p1.length < 6) return "Password must be at least 6 characters.";
    if (p1 !== p2) return "Passwords do not match.";
    console.log("[validateSetPw] Validation passed");
    return null;
  }

  /* =========================
    Product save / delete
  ========================= */
  async function uploadImagesForProduct(productId) {
    console.log(
      "[uploadImagesForProduct] Uploading images for product:",
      productId,
    );
    const input = $("#pImageFiles");
    const files = input?.files || [];
    if (!files.length) {
      console.log("[uploadImagesForProduct] No files to upload");
      return [];
    }
    console.log("[uploadImagesForProduct] Files to upload:", files.length);

    const bucket = supabase.storage.from("product-images");
    const uploadedUrls = [];

    for (const file of files) {
      // Compress image before upload
      const compressedFile = await compressImage(file, 1200, 0.85);

      const safeName = String(compressedFile.name || "img").replace(
        /\s+/g,
        "_",
      );
      const path = `products/${productId}/${Date.now()}_${safeName}`;

      const up = await bucket.upload(path, compressedFile, { upsert: false });
      if (up.error) {
        console.error("[uploadImagesForProduct] Upload error:", up.error);
        continue;
      }
      const pub = bucket.getPublicUrl(path);
      const url = pub?.data?.publicUrl;
      if (url) uploadedUrls.push(url);
    }

    return uploadedUrls;
  }

  async function bindProductActions() {
    console.log("[bindProductActions] Binding product action handlers");
    on($("#adminProductsList"), "click", async (e) => {
      const editBtn = e.target?.closest("button[data-edit]");
      const delBtn = e.target?.closest("button[data-delete]");
      const selectBox = e.target?.closest("[data-select]");
      const openArea = e.target?.closest("[data-open-images]");

      // Handle selection checkbox
      if (selectBox?.dataset?.select) {
        e.stopPropagation();
        if (!bulkMode) toggleBulkMode(true);
        toggleProductSelection(selectBox.dataset.select);
        return;
      }

      if (editBtn?.dataset?.edit) {
        console.log(
          "[bindProductActions] Edit clicked for:",
          editBtn.dataset.edit,
        );
        return startEdit(editBtn.dataset.edit);
      }

      if (delBtn?.dataset?.delete) {
        console.log(
          "[bindProductActions] Delete clicked for:",
          delBtn.dataset.delete,
        );

        const confirmed = await showConfirmModal({
          title: "Delete this product?",
          message: "It will be moved to trash. You can restore it later.",
          type: "danger",
          confirmText: "Delete",
        });

        if (!confirmed) return;

        const productId = delBtn.dataset.delete;
        const product = productsCache.find(
          (p) => String(p.id) === String(productId),
        );

        // Soft delete instead of hard delete
        const { error } = await supabase
          .from("products")
          .update({ is_deleted: true })
          .eq("id", productId);

        if (error) {
          console.error("[bindProductActions] Soft delete error:", error);
          return showToast("Delete failed");
        }
        console.log("[bindProductActions] Soft delete success");

        // Log activity
        await logActivity("delete", "product", productId, {
          name: product?.name || "Unknown",
        });

        // Show undo toast
        showUndoToast(`"${product?.name || "Product"}" deleted`, async () => {
          await supabase
            .from("products")
            .update({ is_deleted: false })
            .eq("id", productId);
          showToast("Product restored");
          await loadInventory();
        });

        await loadInventory();
        return;
      }

      if (openArea) {
        const card = e.target?.closest(".product-card");
        const id = card?.dataset?.productId;
        const product = productsCache.find((p) => String(p.id) === String(id));
        if (product) openImgViewer(product);
      }
    });

    on($("[data-refresh]"), "click", loadInventory);
    on($("[data-clear-form]"), "click", resetForm);
    on($("#pColorMode"), "change", () => {
      toggleColorUI();
      updateVariantMatrix();
    });

    // Color and Size stock management
    setupColorStockEvents();
    setupSizeStockEvents();

    on($("#deleteBtn"), "click", async () => {
      const id = $("#productId")?.value;
      console.log("[deleteBtn] Delete button clicked for:", id);
      if (!id) return;

      const confirmed = await showConfirmModal({
        title: "Delete this product?",
        message: "It will be moved to trash. You can restore it later.",
        type: "danger",
        confirmText: "Delete",
      });

      if (!confirmed) return;

      const product = productsCache.find((p) => String(p.id) === String(id));

      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("products")
        .update({ is_deleted: true })
        .eq("id", id);

      if (error) {
        console.error("Delete error:", error);
        return showToast(
          "Delete failed: " + (error.message || error.code || "Unknown error"),
        );
      }

      // Log activity
      await logActivity("delete", "product", id, {
        name: product?.name || "Unknown",
      });

      // Show undo toast
      showUndoToast(`"${product?.name || "Product"}" deleted`, async () => {
        await supabase
          .from("products")
          .update({ is_deleted: false })
          .eq("id", id);
        showToast("Product restored");
        await loadInventory();
      });

      resetForm();
      switchView("inventory");
      await loadInventory();
    });

    on($("#productForm"), "submit", async (e) => {
      e.preventDefault();
      console.log("[productForm] Form submitted");
      const btn = $("#productForm button[type='submit']");
      setBtnLoading(btn, true, "Saving...");

      try {
        const existingId = ($("#productId")?.value || "").trim();
        console.log("[productForm] Mode:", existingId ? "update" : "create");
        const productId =
          existingId ||
          (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));

        const uploaded = await uploadImagesForProduct(productId);

        const sizes = (() => {
          try {
            return JSON.parse($("#pSizes")?.value || "[]");
          } catch {
            return [];
          }
        })();

        const colorMode = $("#pColorMode")?.value || "open";
        const isOpen = colorMode === "open";

        const finalImages = [...studioExisting, ...uploaded];

        // Get colors - now stored as JSON array of {name, qty} objects
        const colorsData = getColorStockData();

        // Get variant stock (size-color combinations)
        const variantStock = getVariantStockData();

        const payload = {
          name: $("#pName")?.value || "",
          description: $("#pDescription")?.value || "",
          price_ngn: Number($("#pPrice")?.value || 0),
          qty: Number($("#pQty")?.value || 0),
          category: $("#pCategory")?.value || "",
          gender: $("#pGender")?.value || "",
          delivery_type: $("#pDeliveryType")?.value || "standard",
          sizes,
          allow_color_selection: isOpen,
          pack_type: $("#pPackType")?.value || "2-in-1",
          colors: isOpen ? colorsData : [],
          variant_stock:
            isOpen && sizes.length > 0 && colorsData.length > 0
              ? variantStock
              : [],
          is_active: !!$("#pIsActive")?.checked,
          is_new: !!$("#pIsNew")?.checked,
          images: finalImages,
        };

        const { error } = existingId
          ? await supabase.from("products").update(payload).eq("id", productId)
          : await supabase
              .from("products")
              .insert({ id: productId, ...payload });

        if (error) {
          console.error("[productForm] Save error:", error);
          throw error;
        }
        console.log("[productForm] Product saved successfully");

        // Log activity
        await logActivity(
          existingId ? "update" : "create",
          "product",
          productId,
          { name: payload.name },
        );

        showToast("Saved");
        resetForm();
        switchView("inventory");
        await loadInventory();
      } catch (err) {
        console.error("Save error:", err);
        showToast("Error saving: " + explainError(err));
      } finally {
        setBtnLoading(btn, false);
      }
    });
  }

  /* =========================
    Analytics Module
  ========================= */
  async function loadAnalytics() {
    console.log("[loadAnalytics] Loading analytics data");
    const config = window.APP_CONFIG || {};
    const gaId = config.GA_MEASUREMENT_ID || "";
    const fbId = config.FB_PIXEL_ID || "";

    // Update setup status cards
    const gaStatus = $("#gaStatus");
    const fbStatus = $("#fbStatus");
    const gaBadge = $("#gaBadge");
    const fbBadge = $("#fbBadge");

    if (gaStatus) {
      if (gaId) {
        gaStatus.textContent = `Connected: ${gaId}`;
        gaBadge.textContent = "Active";
        gaBadge.className = "analytics-setup-badge active";
      } else {
        gaStatus.textContent =
          "Not configured — add GA_MEASUREMENT_ID to config.js";
        gaBadge.textContent = "Inactive";
        gaBadge.className = "analytics-setup-badge inactive";
      }
    }
    if (fbStatus) {
      if (fbId) {
        fbStatus.textContent = `Connected: ${fbId}`;
        fbBadge.textContent = "Active";
        fbBadge.className = "analytics-setup-badge active";
      } else {
        fbStatus.textContent = "Not configured — add FB_PIXEL_ID to config.js";
        fbBadge.textContent = "Inactive";
        fbBadge.className = "analytics-setup-badge inactive";
      }
    }

    // Load real data from Supabase
    try {
      const period = parseInt($("#analyticsPeriod")?.value || "30");
      const since = new Date();
      since.setDate(since.getDate() - period);
      const sinceISO = since.toISOString();

      // Fetch orders for the period
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, total, status, created_at")
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch total customers
      const { count: customerCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_admin", false);

      // Fetch all-time totals
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, total, status");

      const totalRevenue = (allOrders || [])
        .filter((o) => o.status === "delivered")
        .reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
      const totalOrders = (allOrders || []).length;
      const conversionRate =
        customerCount > 0
          ? ((totalOrders / customerCount) * 100).toFixed(1)
          : "0";

      // Update stat boxes
      const fmt = (n) =>
        "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
      const anTotalCustomers = $("#anTotalCustomers");
      const anTotalOrders = $("#anTotalOrders");
      const anTotalRevenue = $("#anTotalRevenue");
      const anConversionRate = $("#anConversionRate");

      if (anTotalCustomers) anTotalCustomers.textContent = customerCount || 0;
      if (anTotalOrders) anTotalOrders.textContent = totalOrders;
      if (anTotalRevenue) anTotalRevenue.textContent = fmt(totalRevenue);
      if (anConversionRate) anConversionRate.textContent = conversionRate + "%";

      // Fetch page views from site_visits
      const { count: totalPageViews } = await supabase
        .from("site_visits")
        .select("id", { count: "exact", head: true });

      const { data: periodVisits } = await supabase
        .from("site_visits")
        .select("page, created_at")
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: true });

      const anPageViews = $("#anPageViews");
      if (anPageViews) anPageViews.textContent = totalPageViews || 0;

      // Revenue bar chart (daily totals for period)
      renderRevenueChart(orders || [], period);

      // Orders donut chart
      renderOrdersDonut(allOrders || []);

      // Traffic bar chart (daily visits)
      renderTrafficChart(periodVisits || [], period);

      // Top pages table
      renderTopPages(periodVisits || []);

      // Top products
      await renderTopProducts();

      // Geo analytics (country & Nigerian state)
      await loadGeoAnalytics();
    } catch (err) {
      console.error("[loadAnalytics] Error:", err);
    }
  }

  function renderRevenueChart(orders, period) {
    const container = $("#revenueBarChart");
    if (!container) return;

    // Group by date
    const daily = {};
    orders.forEach((o) => {
      const d = new Date(o.created_at).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      });
      daily[d] = (daily[d] || 0) + (parseFloat(o.total) || 0);
    });

    const entries = Object.entries(daily);
    if (!entries.length) {
      container.innerHTML =
        '<p class="text-muted text-center" style="padding:2rem">No order data for this period</p>';
      return;
    }

    const maxVal = Math.max(...entries.map(([, v]) => v), 1);

    container.innerHTML = entries
      .map(([date, val]) => {
        const pct = Math.max((val / maxVal) * 100, 4);
        const fmt =
          "₦" + val.toLocaleString("en-NG", { maximumFractionDigits: 0 });
        return `
        <div class="bar-col">
          <div class="bar-tooltip">${fmt}</div>
          <div class="bar-fill" style="height:${pct}%"></div>
          <span class="bar-label">${date}</span>
        </div>
      `;
      })
      .join("");
  }

  function renderOrdersDonut(orders) {
    const container = $("#ordersDonut");
    if (!container) return;

    const statusMap = {};
    orders.forEach((o) => {
      const s = o.status || "pending";
      statusMap[s] = (statusMap[s] || 0) + 1;
    });

    const total = orders.length;
    const divisor = total || 1; // avoid division by zero
    const colors = {
      pending: "#f59e0b",
      processing: "#3b82f6",
      shipped: "#8b5cf6",
      delivered: "#10b981",
      cancelled: "#ef4444",
      refunded: "#6b7280",
    };

    let offset = 0;
    const segments = Object.entries(statusMap).map(([status, count]) => {
      const pct = (count / divisor) * 100;
      const seg = {
        status,
        count,
        pct,
        offset,
        color: colors[status] || "#9ca3af",
      };
      offset += pct;
      return seg;
    });

    // CSS conic-gradient donut
    const gradParts = segments
      .map((s) => `${s.color} ${s.offset - s.pct}% ${s.offset}%`)
      .join(", ");

    container.innerHTML = `
      <div class="donut-ring" style="background:conic-gradient(${gradParts})">
        <div class="donut-center">
          <span class="donut-total">${total}</span>
          <span class="donut-label">Orders</span>
        </div>
      </div>
      <div class="donut-legend">
        ${segments
          .map(
            (s) => `
          <div class="donut-legend-item">
            <span class="donut-dot" style="background:${s.color}"></span>
            <span>${escapeHtml(s.status)}</span>
            <strong>${s.count}</strong>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  function renderTrafficChart(visits, period) {
    const container = $("#trafficBarChart");
    if (!container) return;

    const daily = {};
    visits.forEach((v) => {
      const d = new Date(v.created_at).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      });
      daily[d] = (daily[d] || 0) + 1;
    });

    const entries = Object.entries(daily);
    if (!entries.length) {
      container.innerHTML =
        '<p class="text-muted text-center" style="padding:2rem">No traffic data for this period</p>';
      return;
    }

    const maxVal = Math.max(...entries.map(([, v]) => v), 1);

    container.innerHTML = entries
      .map(([date, val]) => {
        const pct = Math.max((val / maxVal) * 100, 4);
        return `
        <div class="bar-col">
          <div class="bar-tooltip">${val} visits</div>
          <div class="bar-fill bar-fill--traffic" style="height:${pct}%"></div>
          <span class="bar-label">${date}</span>
        </div>
      `;
      })
      .join("");
  }

  function renderTopPages(visits) {
    const container = $("#topPagesTable");
    if (!container) return;

    if (!visits.length) {
      container.innerHTML =
        '<p class="text-muted text-center" style="padding:2rem">No page data yet</p>';
      return;
    }

    const pageCounts = {};
    visits.forEach((v) => {
      const pg = v.page || "/";
      pageCounts[pg] = (pageCounts[pg] || 0) + 1;
    });

    const sorted = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    const total = visits.length;

    container.innerHTML = `
      <table class="table">
        <thead><tr><th>#</th><th>Page</th><th>Views</th><th>%</th></tr></thead>
        <tbody>
          ${sorted
            .map(
              ([page, count], i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(page)}</td>
              <td>${count}</td>
              <td>${((count / total) * 100).toFixed(1)}%</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  async function renderTopProducts() {
    const container = $("#topProductsTable");
    if (!container) return;

    try {
      // Get order items and count
      const { data: orders } = await supabase
        .from("orders")
        .select("items, status");

      if (!orders || !orders.length) {
        container.innerHTML =
          '<p class="text-muted text-center" style="padding:2rem">No order data yet</p>';
        return;
      }

      // Tally product occurrences — only count delivered orders for revenue
      const productCounts = {};
      const productRevenue = {};
      orders.forEach((order) => {
        const items = order.items || [];
        const isDelivered = order.status === "delivered";
        items.forEach((item) => {
          const name = item.name || "Unknown";
          const qty = item.quantity || item.qty || 1;
          const price = item.price_ngn || item.price || 0;
          productCounts[name] = (productCounts[name] || 0) + qty;
          if (isDelivered) {
            productRevenue[name] = (productRevenue[name] || 0) + price * qty;
          }
        });
      });

      const sorted = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (!sorted.length) {
        container.innerHTML =
          '<p class="text-muted text-center" style="padding:2rem">No product data</p>';
        return;
      }

      const fmt = (n) =>
        "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
      container.innerHTML = `
        <table class="table">
          <thead><tr><th>#</th><th>Product</th><th>Units Sold</th><th>Revenue</th></tr></thead>
          <tbody>
            ${sorted
              .map(
                ([name, count], i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(name)}</td>
                <td>${count}</td>
                <td>${fmt(productRevenue[name] || 0)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error("[renderTopProducts] Error:", err);
      container.innerHTML =
        '<p class="text-muted text-center">Failed to load</p>';
    }
  }

  // Analytics refresh & period change handlers
  on($("#analyticsRefreshBtn"), "click", () => loadAnalytics());
  on($("#analyticsPeriod"), "change", () => loadAnalytics());

  /* ─────────────────────────────────────────────
   * Geo Analytics: Visitors by Country & Nigerian State
   * ───────────────────────────────────────────── */
  async function loadGeoAnalytics() {
    const countryEl = $("#geoCountryTable");
    const stateEl = $("#geoStateTable");
    if (!countryEl && !stateEl) return;

    try {
      const days = parseInt($("#analyticsPeriod")?.value || "30", 10);
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data: visits, error } = await supabase
        .from("site_visits")
        .select("country, country_code, region")
        .gte("created_at", since.toISOString());

      if (error) throw error;

      // ── Visits by Country ──
      if (countryEl) {
        if (!visits?.length) {
          countryEl.innerHTML =
            '<p class="text-muted text-center" style="padding:2rem">No visitor data yet</p>';
        } else {
          const countryCounts = {};
          visits.forEach((v) => {
            const key = v.country || "Unknown";
            countryCounts[key] = (countryCounts[key] || 0) + 1;
          });
          const sorted = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
          const total = visits.length;

          countryEl.innerHTML = `
            <table class="table">
              <thead><tr><th>#</th><th>Country</th><th>Visits</th><th>%</th></tr></thead>
              <tbody>
                ${sorted
                  .map(
                    ([country, count], i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(country)}</td>
                    <td>${count}</td>
                    <td>${((count / total) * 100).toFixed(1)}%</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          `;
        }
      }

      // ── Nigerian Visitors by State ──
      if (stateEl) {
        const ngVisits = visits?.filter((v) => v.country_code === "NG") || [];
        if (!ngVisits.length) {
          stateEl.innerHTML =
            '<p class="text-muted text-center" style="padding:2rem">No Nigerian visitor data yet</p>';
        } else {
          const stateCounts = {};
          ngVisits.forEach((v) => {
            const key = v.region || "Unknown";
            stateCounts[key] = (stateCounts[key] || 0) + 1;
          });
          const sorted = Object.entries(stateCounts).sort(
            (a, b) => b[1] - a[1],
          );
          const total = ngVisits.length;

          stateEl.innerHTML = `
            <table class="table">
              <thead><tr><th>#</th><th>State</th><th>Visits</th><th>%</th></tr></thead>
              <tbody>
                ${sorted
                  .map(
                    ([state, count], i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(state)}</td>
                    <td>${count}</td>
                    <td>${((count / total) * 100).toFixed(1)}%</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          `;
        }
      }
    } catch (err) {
      console.error("[loadGeoAnalytics] Error:", err);
      if (countryEl)
        countryEl.innerHTML =
          '<p class="text-muted text-center">Failed to load geo data</p>';
      if (stateEl)
        stateEl.innerHTML =
          '<p class="text-muted text-center">Failed to load state data</p>';
    }
  }

  /* =========================
    Customers Management
  ========================= */
  let allCustomers = [];

  async function loadCustomers() {
    console.log("[loadCustomers] Loading customers");
    const body = $("#customersBody");
    if (!body) return;

    body.innerHTML =
      '<tr><td colspan="7"><div class="skeleton skeleton-text" style="height:16px;margin:8px 0"></div></td></tr><tr><td colspan="7"><div class="skeleton skeleton-text skeleton-text--long" style="height:16px;margin:8px 0"></div></td></tr><tr><td colspan="7"><div class="skeleton skeleton-text skeleton-text--med" style="height:16px;margin:8px 0"></div></td></tr>';

    try {
      // Fetch all non-admin profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at, is_admin")
        .eq("is_admin", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch order summaries per customer email
      const { data: orders } = await supabase
        .from("orders")
        .select("customer_email, total, status");

      const orderMap = {};
      (orders || []).forEach((o) => {
        const key = (o.customer_email || "").toLowerCase();
        if (!orderMap[key]) orderMap[key] = { count: 0, spent: 0 };
        orderMap[key].count++;
        if (o.status === "delivered")
          orderMap[key].spent += parseFloat(o.total) || 0;
      });

      allCustomers = (profiles || []).map((p) => {
        const key = (p.email || "").toLowerCase();
        const stats = orderMap[key] || { count: 0, spent: 0 };
        return { ...p, orderCount: stats.count, totalSpent: stats.spent };
      });

      // Update stats
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const newCount = allCustomers.filter(
        (c) => new Date(c.created_at) >= thirtyDaysAgo,
      ).length;
      const withOrders = allCustomers.filter((c) => c.orderCount > 0).length;

      const totalEl = $("#custTotalCount");
      const newEl = $("#custNewCount");
      const withOrdersEl = $("#custWithOrdersCount");
      if (totalEl) totalEl.textContent = allCustomers.length;
      if (newEl) newEl.textContent = newCount;
      if (withOrdersEl) withOrdersEl.textContent = withOrders;

      renderCustomers(allCustomers);
    } catch (err) {
      console.error("[loadCustomers] Error:", err);
      body.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">Failed to load customers</td></tr>';
    }
  }

  function renderCustomers(customers) {
    const body = $("#customersBody");
    if (!body) return;

    if (!customers.length) {
      body.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">No customers found</td></tr>';
      return;
    }

    const fmt = (n) =>
      "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
    body.innerHTML = customers
      .map(
        (c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(c.full_name || "—")}</td>
          <td>${escapeHtml(c.email || "—")}</td>
          <td>${escapeHtml(c.phone || "—")}</td>
          <td>${c.orderCount}</td>
          <td>${fmt(c.totalSpent)}</td>
          <td>${c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB") : "—"}</td>
        </tr>
      `,
      )
      .join("");
  }

  // Customer search
  on($("#customerSearch"), "input", (e) => {
    const q = (e.target.value || "").toLowerCase();
    if (!q) {
      renderCustomers(allCustomers);
      return;
    }
    const filtered = allCustomers.filter((c) =>
      [c.full_name, c.email, c.phone].some((f) =>
        (f || "").toLowerCase().includes(q),
      ),
    );
    renderCustomers(filtered);
  });

  // Customer export dropdown
  (function bindCustomerExport() {
    const btn = $("#customerExportBtn");
    const menu = $("#customerExportMenu");
    if (!btn || !menu) return;

    on(btn, "click", (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", () => {
      if (menu) menu.hidden = true;
    });

    on(menu, "click", (e) => {
      const opt = e.target.closest("[data-customer-export]");
      if (!opt) return;
      menu.hidden = true;
      const fmt = opt.dataset.customerExport;
      exportCustomersAs(fmt);
    });
  })();

  function exportCustomersAs(format) {
    if (!allCustomers.length) {
      showToast("No customers to export");
      return;
    }

    const date = new Date().toISOString().split("T")[0];
    const rows = allCustomers.map((c) => ({
      name: c.full_name || "",
      email: c.email || "",
      phone: c.phone || "",
      orders: c.orderCount,
      total_spent: c.totalSpent,
      joined: c.created_at
        ? new Date(c.created_at).toLocaleDateString("en-GB")
        : "",
    }));

    if (format === "csv") {
      exportToCSV(rows, `customers_${date}.csv`);
    } else if (format === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, `customers_${date}.json`);
    } else if (format === "txt") {
      const header = "Name | Email | Phone | Orders | Total Spent | Joined";
      const sep = "-".repeat(80);
      const lines = rows.map(
        (r) =>
          `${r.name} | ${r.email} | ${r.phone} | ${r.orders} | ₦${r.total_spent.toLocaleString()} | ${r.joined}`,
      );
      const text = [header, sep, ...lines].join("\n");
      const blob = new Blob([text], { type: "text/plain" });
      downloadBlob(blob, `customers_${date}.txt`);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported successfully");
  }

  /* =========================
    Reviews Management
  ========================= */
  let allReviews = [];

  async function loadReviews() {
    const list = $("#adminReviewsList");
    const statsEl = $("#reviewsStats");
    if (!list) return;

    list.innerHTML = '<p class="text-muted text-center">Loading reviews...</p>';

    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      allReviews = data || [];
      renderReviewsStats(statsEl, allReviews);
      filterAndRenderReviews();
    } catch (err) {
      console.error("[loadReviews] Error:", err);
      list.innerHTML = `<p class="text-muted text-center">Error loading reviews: ${err.message}</p>`;
    }
  }

  function renderReviewsStats(el, reviews) {
    if (!el) return;
    const total = reviews.length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const pending = reviews.filter((r) => r.status === "pending").length;
    const rejected = reviews.filter((r) => r.status === "rejected").length;
    const avgRating =
      total > 0
        ? (
            reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / total
          ).toFixed(1)
        : "0.0";

    el.innerHTML = `
      <div class="stats-row">
        <div class="stat-box"><strong>${total}</strong><span>Total</span></div>
        <div class="stat-box"><strong>${approved}</strong><span>Approved</span></div>
        <div class="stat-box"><strong>${pending}</strong><span>Pending</span></div>
        <div class="stat-box"><strong>${rejected}</strong><span>Rejected</span></div>
        <div class="stat-box"><strong>${avgRating} ★</strong><span>Avg Rating</span></div>
      </div>
    `;
  }

  function filterAndRenderReviews() {
    const statusFilter = $("#reviewsFilterStatus")?.value || "all";
    const ratingFilter = $("#reviewsFilterRating")?.value || "all";

    let filtered = [...allReviews];
    if (statusFilter !== "all")
      filtered = filtered.filter((r) => r.status === statusFilter);
    if (ratingFilter !== "all")
      filtered = filtered.filter((r) => String(r.rating) === ratingFilter);

    renderReviewsList(filtered);
  }

  function renderReviewsList(reviews) {
    const list = $("#adminReviewsList");
    if (!list) return;

    if (reviews.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-star-half-stroke" style="font-size:2rem;opacity:0.3"></i>
          <p class="text-muted">No reviews found</p>
        </div>`;
      return;
    }

    list.innerHTML = reviews
      .map((r) => {
        const stars =
          "★".repeat(r.rating || 0) + "☆".repeat(5 - (r.rating || 0));
        const date = new Date(r.created_at).toLocaleDateString("en-NG", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const statusClass = r.status || "pending";
        return `
          <div class="review-card" data-review-id="${r.id}">
            <div class="review-header">
              <div class="review-meta">
                <strong>${escapeHtml(r.reviewer_name || r.customer_email || "Anonymous")}</strong>
                <span class="review-date">${date}</span>
              </div>
              <span class="review-rating">${stars}</span>
            </div>
            ${r.product_name ? `<p class="review-product"><i class="fa-solid fa-tag"></i> ${escapeHtml(r.product_name)}</p>` : ""}
            <p class="review-text">${escapeHtml(r.comment || r.review_text || "")}</p>
            <div class="review-actions">
              <span class="order-status ${statusClass}">${statusClass}</span>
              ${statusClass !== "approved" ? `<button class="btn btn-sm btn-success" onclick="window._adminApproveReview('${r.id}')"><i class="fa-solid fa-check"></i> Approve</button>` : ""}
              ${statusClass !== "rejected" ? `<button class="btn btn-sm btn-danger" onclick="window._adminRejectReview('${r.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>` : ""}
              <button class="btn btn-sm btn-outline" onclick="window._adminDeleteReview('${r.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`;
      })
      .join("");
  }

  async function updateReviewStatus(reviewId, status) {
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ status })
        .eq("id", reviewId);
      if (error) throw error;
      showToast(`Review ${status}`);
      loadReviews();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  }

  async function deleteReview(reviewId) {
    if (!confirm("Delete this review permanently?")) return;
    try {
      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", reviewId);
      if (error) throw error;
      showToast("Review deleted");
      loadReviews();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  }

  // Expose review actions globally for inline onclick handlers
  window._adminApproveReview = (id) => updateReviewStatus(id, "approved");
  window._adminRejectReview = (id) => updateReviewStatus(id, "rejected");
  window._adminDeleteReview = (id) => deleteReview(id);

  // Review filter event listeners
  function bindReviewFilters() {
    const statusFilter = $("#reviewsFilterStatus");
    const ratingFilter = $("#reviewsFilterRating");
    if (statusFilter)
      statusFilter.addEventListener("change", filterAndRenderReviews);
    if (ratingFilter)
      ratingFilter.addEventListener("change", filterAndRenderReviews);
  }

  /* =========================
    Init
  ========================= */
  async function init() {
    console.log("[init] Initializing admin panel");
    bindThemeSystemSync();

    bindPasswordToggles();
    bindNav();
    bindReviewFilters();
    bindMessagesActions();
    bindSizesDropdown();
    bindFormSelectDropdowns();
    bindStudioSlider();
    bindViewerModal();
    bindInviteModal();
    bindCompleteProfileModal();
    bindConfirmModal();
    bindSearchAndFilter();
    bindTrashActions();
    bindAdminsActions();
    bindOrdersActions();
    bindSiteImagesActions();
    await bindProductActions();

    // Enhanced features
    bindThemeToggle();
    bindPagination();
    bindBulkActions();
    bindExport();
    bindKeyboardShortcuts();
    bindSessionTimeout();
    console.log("[init] All bindings complete (including enhancements)");

    $$("[data-auth-tab]").forEach((b) =>
      on(b, "click", () => showAuthView(b.dataset.authTab)),
    );
    on($("#openResetBtn"), "click", () => showAuthView("reset"));
    on($("#backToLoginBtn"), "click", () => showAuthView("login"));

    $$("[data-view-target]").forEach((b) =>
      on(b, "click", () => switchView(b.dataset.viewTarget)),
    );

    // LOGIN
    on($("#loginForm"), "submit", async (e) => {
      e.preventDefault();
      console.log("[loginForm] Login form submitted");
      clearAuthMsg();

      const msg = validateLogin();
      if (msg) return setAuthMsg(msg);

      const btn = $("#loginForm button[type='submit']");
      setBtnLoading(btn, true, "Signing in...");

      try {
        const email = $("#loginEmail").value.trim();
        const password = $("#loginPassword").value;

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return setAuthMsg(explainError(error));

        await gateWithSession(data?.session || null, "login");
      } catch (err) {
        console.error("Login exception:", err);
        setAuthMsg(
          "Network error. Please check your connection and try again.",
        );
      } finally {
        setBtnLoading(btn, false);
      }
    });

    // SIGNUP
    on($("#signupForm"), "submit", async (e) => {
      e.preventDefault();
      console.log("[signupForm] Signup form submitted");
      clearAuthMsg();

      const msg = validateSignup();
      if (msg) return setAuthMsg(msg);

      const btn = $("#signupForm button[type='submit']");
      setBtnLoading(btn, true, "Creating account...");

      try {
        const firstName = $("#firstName").value.trim();
        const lastName = $("#lastName").value.trim();
        const email = $("#signupEmail").value.trim();
        const password = $("#signupPassword").value;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName },
            emailRedirectTo: window.location.origin + "/admin",
          },
        });

        if (error) return setAuthMsg(explainError(error));

        // Check if email confirmation is required
        if (data?.user && !data?.session) {
          // Email confirmation required - show confirmation view
          showEmailConfirmationView(email);
        } else if (data?.session) {
          // Auto-confirmed (disabled confirmation) - go to dashboard
          showToast("Account created successfully!");
          await gateWithSession(data.session, "login");
        } else {
          showToast("Account created. Please check your email.");
          showAuthView("login");
        }
      } catch (err) {
        console.error("Signup exception:", err);
        setAuthMsg("Network error. Please try again.");
      } finally {
        setBtnLoading(btn, false);
      }
    });

    // RESET
    on($("#resetForm"), "submit", async (e) => {
      e.preventDefault();
      console.log("[resetForm] Reset password form submitted");
      clearAuthMsg();

      const msg = validateReset();
      if (msg) return setAuthMsg(msg);

      const btn = $("#resetForm button[type='submit']");
      setBtnLoading(btn, true, "Sending...");

      try {
        const email = $("#resetEmail").value.trim();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: AUTH_REDIRECT_URL,
        });
        if (error) return setAuthMsg(explainError(error));

        showToast("If the email exists, a recovery link has been sent.");
        showAuthView("login");
      } catch (err) {
        console.error("Reset exception:", err);
        setAuthMsg("Network error. Please try again.");
      } finally {
        setBtnLoading(btn, false);
      }
    });

    // SET PASSWORD
    on($("#setPasswordForm"), "submit", async (e) => {
      e.preventDefault();
      console.log("[setPasswordForm] Set password form submitted");
      clearAuthMsg();

      const msg = validateSetPw();
      if (msg) return setAuthMsg(msg);

      const btn = $("#setPasswordForm button[type='submit']");
      setBtnLoading(btn, true, "Updating...");

      try {
        const p1 = $("#newPassword").value;
        const { error } = await supabase.auth.updateUser({ password: p1 });
        if (error) return setAuthMsg(explainError(error));

        showToast("Password updated. Please log in.");
        await supabase.auth.signOut();
        showAuthView("login");
      } catch (err) {
        console.error("Set password exception:", err);
        setAuthMsg("Network error. Please try again.");
      } finally {
        setBtnLoading(btn, false);
      }
    });

    // Logout
    on($("#logoutBtn"), "click", async () => {
      console.log("[logoutBtn] Logout clicked");
      await supabase.auth.signOut();
      window.location.reload();
    });

    // Auth state change listener - handles email confirmation redirect
    supabase.auth.onAuthStateChange(async (evt, session) => {
      console.log("[onAuthStateChange] Event:", evt);

      if (evt === "PASSWORD_RECOVERY") {
        showAuthView("setpw");
      } else if (evt === "SIGNED_IN" && session) {
        // User just confirmed email or signed in - redirect to dashboard
        const confirmView = $("#emailConfirmationView");
        if (confirmView && !confirmView.hidden) {
          showToast("Email confirmed! Redirecting to dashboard...");
          setTimeout(async () => {
            await gateWithSession(session, "login");
          }, 1000);
        }
      }
    });

    // init UI state
    toggleColorUI();
    updateSizeLabel();
    renderStudioSlider();
    setStudioMode(false);

    await autoGateOnce();
    console.log("[init] Initialization complete");
  }

  /* ========================================================================
     MESSAGES MODULE — Split-pane Inbox
     ======================================================================== */

  let messagesCache = [];
  let currentMessagesPage = 1;
  const MESSAGES_PER_PAGE = 20;
  let currentMsgStatusFilter = "";
  let currentMsgSubjectFilter = "";
  let currentMsgSearch = "";
  let openMessageId = null;

  const SUBJECT_LABELS = {
    general: "General Inquiry",
    order: "Order Issue",
    returns: "Returns & Exchanges",
    sizing: "Sizing Help",
    wholesale: "Wholesale",
    other: "Other",
    order_notification: "Order Notification",
  };

  /* ── Data Loading ── */
  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      messagesCache = data || [];
      updateMessagesStats();
      updateUnreadBadge();
      renderMessagesList();
    } catch (err) {
      console.error("[loadMessages]", err);
      const el = $("#messagesList");
      if (el) el.innerHTML = '<div class="inbox-list-empty"><i class="fa-solid fa-exclamation-circle"></i><h4>Failed to load</h4><p>Check connection and retry</p></div>';
    }
  }

  function updateMessagesStats() {
    const total = messagesCache.length;
    const unread = messagesCache.filter(m => m.status === "unread" || !m.status).length;
    const replied = messagesCache.filter(m => m.status === "replied").length;
    const totalEl = $("#msgTotalCount");
    const unreadEl = $("#msgUnreadCount");
    const repliedEl = $("#msgRepliedCount");
    if (totalEl) totalEl.querySelector("b").textContent = total;
    if (unreadEl) unreadEl.querySelector("b").textContent = unread;
    if (repliedEl) repliedEl.querySelector("b").textContent = replied;
  }

  function updateUnreadBadge() {
    const badge = $("#unreadMessagesBadge");
    if (!badge) return;
    const unread = messagesCache.filter(m => m.status === "unread" || !m.status).length;
    badge.textContent = unread;
    badge.hidden = unread === 0;
  }

  /* ── Filtering ── */
  function getFilteredMessages() {
    let filtered = [...messagesCache];
    if (currentMsgStatusFilter) {
      if (currentMsgStatusFilter === "unread") {
        filtered = filtered.filter(m => m.status === "unread" || !m.status);
      } else {
        filtered = filtered.filter(m => m.status === currentMsgStatusFilter);
      }
    }
    if (currentMsgSubjectFilter) {
      filtered = filtered.filter(m => m.subject === currentMsgSubjectFilter);
    }
    if (currentMsgSearch) {
      const q = currentMsgSearch.toLowerCase();
      filtered = filtered.filter(m =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.message || "").toLowerCase().includes(q) ||
        (m.order_id || m.orderId || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  /* ── Render List ── */
  function renderMessagesList() {
    const container = $("#messagesList");
    const pagContainer = $("#messagesPagination");
    if (!container) return;

    const filtered = getFilteredMessages();
    const totalPages = Math.max(1, Math.ceil(filtered.length / MESSAGES_PER_PAGE));
    if (currentMessagesPage > totalPages) currentMessagesPage = totalPages;

    const start = (currentMessagesPage - 1) * MESSAGES_PER_PAGE;
    const page = filtered.slice(start, start + MESSAGES_PER_PAGE);

    if (page.length === 0) {
      container.innerHTML = `
        <div class="inbox-list-empty">
          <i class="fa-solid fa-envelope-open"></i>
          <h4>No messages${(currentMsgStatusFilter || currentMsgSubjectFilter || currentMsgSearch) ? " match your filters" : " yet"}</h4>
          <p>Contact form submissions will appear here</p>
        </div>`;
      if (pagContainer) pagContainer.innerHTML = "";
      return;
    }

    container.innerHTML = page.map(m => {
      const status = m.status || "unread";
      const initials = (m.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      const date = formatMsgDate(m.timestamp || m.created_at);
      const subjectLabel = SUBJECT_LABELS[m.subject] || m.subject || "General";
      const preview = (m.message || "").slice(0, 90);
      const isActive = String(m.id) === String(openMessageId);
      const statusText = status === "replied" ? '<i class="fa-solid fa-check"></i> Replied' : status === "read" ? "Read" : "New";

      return `
        <div class="inbox-msg-card ${status === "unread" ? "unread" : ""} ${isActive ? "active" : ""}" data-msg-id="${m.id}">
          <div class="inbox-msg-avatar">${escapeHtml(initials)}</div>
          <div class="inbox-msg-body">
            <div class="inbox-msg-row1">
              <span class="inbox-msg-name">${escapeHtml(m.name || "Unknown")}</span>
              <span class="inbox-msg-time">${date}</span>
            </div>
            <div class="inbox-msg-row2">
              <span class="inbox-msg-category" data-cat="${m.subject || "general"}">${escapeHtml(subjectLabel)}</span>
              <span class="inbox-msg-status-badge ${status}">${statusText}</span>
            </div>
            <div class="inbox-msg-preview">${escapeHtml(preview)}</div>
          </div>
        </div>`;
    }).join("");

    // Pagination
    if (pagContainer) {
      if (totalPages <= 1) {
        pagContainer.innerHTML = "";
      } else {
        pagContainer.innerHTML = `
          <button ${currentMessagesPage <= 1 ? "disabled" : ""} id="msgPrevPage"><i class="fa-solid fa-chevron-left"></i></button>
          <span class="page-info">${currentMessagesPage} / ${totalPages}</span>
          <button ${currentMessagesPage >= totalPages ? "disabled" : ""} id="msgNextPage"><i class="fa-solid fa-chevron-right"></i></button>`;
        on($("#msgPrevPage"), "click", () => { currentMessagesPage--; renderMessagesList(); });
        on($("#msgNextPage"), "click", () => { currentMessagesPage++; renderMessagesList(); });
      }
    }

    // Bind card clicks
    $$("[data-msg-id]", container).forEach(card =>
      on(card, "click", () => openMessage(card.dataset.msgId))
    );
  }

  function formatMsgDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return "Now";
      if (diff < 3600000) return Math.floor(diff / 60000) + "m";
      if (diff < 86400000) return Math.floor(diff / 3600000) + "h";
      if (diff < 604800000) return Math.floor(diff / 86400000) + "d";
      return d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
    } catch { return dateStr; }
  }

  /* ── Open Message (Detail Panel) ── */
  async function openMessage(id) {
    const msg = messagesCache.find(m => String(m.id) === String(id));
    if (!msg) return;
    openMessageId = id;

    // On mobile: show detail, hide list
    const listPanel = $("#inboxListPanel");
    const detailPanel = $("#inboxDetailPanel");
    if (window.innerWidth <= 900) {
      listPanel?.classList.add("hide");
      detailPanel?.classList.add("show");
    }

    // Mark as read
    if (!msg.status || msg.status === "unread") {
      try {
        await supabase.from("contact_messages").update({ status: "read" }).eq("id", id);
        msg.status = "read";
        updateMessagesStats();
        updateUnreadBadge();
      } catch (e) { console.error("[openMessage] mark read failed", e); }
    }

    // Show detail content, hide empty
    $("#inboxDetailEmpty").hidden = true;
    const content = $("#inboxDetailContent");
    content.hidden = false;

    // Populate header
    const subjectLabel = SUBJECT_LABELS[msg.subject] || msg.subject || "General Inquiry";
    $("#msgDetailSubject").textContent = subjectLabel;
    $("#msgDetailDate").textContent = new Date(msg.timestamp || msg.created_at).toLocaleString("en-NG", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
    });

    const status = msg.status || "unread";
    const statusEl = $("#msgDetailStatus");
    statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusEl.className = "inbox-detail-badge " + status;

    // Sender
    const initials = (msg.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    $("#msgSenderAvatar").textContent = initials;
    $("#msgSenderName").textContent = msg.name || "Unknown";
    $("#msgSenderEmail").textContent = msg.email || "";

    // Tags
    const phoneTag = $("#msgSenderPhone");
    if (msg.phone) {
      phoneTag.hidden = false;
      phoneTag.querySelector("span").textContent = msg.phone;
    } else { phoneTag.hidden = true; }

    const orderTag = $("#msgSenderOrderId");
    const orderId = msg.order_id || msg.orderId;
    if (orderId) {
      orderTag.hidden = false;
      orderTag.querySelector("span").textContent = orderId;
    } else { orderTag.hidden = true; }

    // Original message bubble
    $("#msgDetailBody").textContent = msg.message || "";

    // Reset reply textarea
    $("#msgReplyText").value = "";

    // Load reply thread
    await loadReplyThread(id);

    // Re-render list to highlight active card
    renderMessagesList();

    // Scroll thread to bottom
    const thread = $("#inboxThread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  /* ── Reply Thread ── */
  async function loadReplyThread(messageId) {
    const container = $("#msgReplyThread");
    if (!container) return;
    try {
      const { data, error } = await supabase
        .from("message_replies")
        .select("*")
        .eq("message_id", messageId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) { container.innerHTML = ""; return; }

      container.innerHTML = data.map(r => `
        <div class="inbox-bubble inbox-bubble--admin">
          <div class="inbox-bubble__meta">
            <span class="inbox-bubble__author"><i class="fa-solid fa-reply" style="margin-right:4px;font-size:10px"></i>Admin</span>
            <span class="inbox-bubble__time">${new Date(r.created_at).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div class="inbox-bubble__text">${escapeHtml(r.reply_text || r.body || "")}</div>
        </div>`).join("");
    } catch (err) {
      console.error("[loadReplyThread]", err);
      container.innerHTML = "";
    }
  }

  /* ── Send Reply ── */
  async function sendReply() {
    const text = $("#msgReplyText")?.value?.trim();
    if (!text) return showToast("Please type a reply", "error");
    if (!openMessageId) return;

    const msg = messagesCache.find(m => String(m.id) === String(openMessageId));
    if (!msg) return;

    const btn = $("#msgSendReplyBtn");
    const origHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    btn.disabled = true;

    try {
      // Get session token
      let { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      if (!token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token;
      }

      const res = await fetch(
        "https://oriojylsilcsvcsefuux.supabase.co/functions/v1/send-admin-reply",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messageId: openMessageId,
            recipientEmail: msg.email,
            recipientName: msg.name,
            originalSubject: SUBJECT_LABELS[msg.subject] || msg.subject || "Your Inquiry",
            originalMessage: msg.message,
            replyText: text,
            fromEmail: $("#msgFromEmail")?.value || "support@lingeriebysisioyin.store",
          }),
        }
      );
      if (!res.ok) { const err = await res.text(); throw new Error(err); }

      // Save reply
      await supabase.from("message_replies").insert({
        message_id: openMessageId,
        reply_text: text,
        sent_by: currentUserId,
        sent_at: new Date().toISOString(),
      });

      // Update status
      await supabase.from("contact_messages").update({ status: "replied" }).eq("id", openMessageId);
      msg.status = "replied";
      $("#msgReplyText").value = "";
      showToast("Reply sent!", "success");

      updateMessagesStats();
      updateUnreadBadge();
      renderMessagesList();
      await loadReplyThread(openMessageId);

      // Update detail badge
      const statusEl = $("#msgDetailStatus");
      statusEl.textContent = "Replied";
      statusEl.className = "inbox-detail-badge replied";

      // Scroll thread to bottom
      const thread = $("#inboxThread");
      if (thread) thread.scrollTop = thread.scrollHeight;
    } catch (err) {
      console.error("[sendReply]", err);
      showToast("Failed to send: " + err.message, "error");
    } finally {
      btn.innerHTML = origHTML;
      btn.disabled = false;
    }
  }

  /* ── Delete Message ── */
  async function deleteMessage() {
    if (!openMessageId) return;
    if (!confirm("Delete this message permanently?")) return;
    try {
      await supabase.from("message_replies").delete().eq("message_id", openMessageId);
      await supabase.from("contact_messages").delete().eq("id", openMessageId);
      messagesCache = messagesCache.filter(m => String(m.id) !== String(openMessageId));
      openMessageId = null;
      $("#inboxDetailContent").hidden = true;
      $("#inboxDetailEmpty").hidden = false;
      updateMessagesStats();
      updateUnreadBadge();
      renderMessagesList();
      showToast("Message deleted", "success");
    } catch (err) {
      console.error("[deleteMessage]", err);
      showToast("Delete failed", "error");
    }
  }

  /* ── Mark as Unread ── */
  async function markAsUnread() {
    if (!openMessageId) return;
    const msg = messagesCache.find(m => String(m.id) === String(openMessageId));
    if (!msg) return;
    try {
      await supabase.from("contact_messages").update({ status: "unread" }).eq("id", openMessageId);
      msg.status = "unread";
      const statusEl = $("#msgDetailStatus");
      statusEl.textContent = "Unread";
      statusEl.className = "inbox-detail-badge unread";
      updateMessagesStats();
      updateUnreadBadge();
      renderMessagesList();
      showToast("Marked as unread", "success");
    } catch (err) {
      console.error("[markAsUnread]", err);
      showToast("Failed", "error");
    }
  }

  /* ── Back button (mobile) ── */
  function inboxGoBack() {
    const listPanel = $("#inboxListPanel");
    const detailPanel = $("#inboxDetailPanel");
    listPanel?.classList.remove("hide");
    detailPanel?.classList.remove("show");
    openMessageId = null;
    renderMessagesList();
  }

  /* ── Bind All Actions ── */
  function bindMessagesActions() {
    on($("#refreshMessagesBtn"), "click", loadMessages);

    // Filter chips
    $$(".inbox-filter-chip").forEach(chip => {
      on(chip, "click", () => {
        $$(".inbox-filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentMsgStatusFilter = chip.dataset.filter;
        currentMessagesPage = 1;
        renderMessagesList();
      });
    });

    // Category select
    on($("#msgSubjectFilter"), "change", e => {
      currentMsgSubjectFilter = e.target.value;
      currentMessagesPage = 1;
      renderMessagesList();
    });

    // Search
    let searchTimer;
    on($("#msgSearchInput"), "input", e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentMsgSearch = e.target.value.trim();
        currentMessagesPage = 1;
        renderMessagesList();
      }, 250);
    });

    // Detail actions
    on($("#msgSendReplyBtn"), "click", sendReply);
    on($("#msgDeleteBtn"), "click", deleteMessage);
    on($("#msgMarkUnreadBtn"), "click", markAsUnread);
    on($("#inboxBackBtn"), "click", inboxGoBack);

  document.addEventListener("DOMContentLoaded", init);
})();
