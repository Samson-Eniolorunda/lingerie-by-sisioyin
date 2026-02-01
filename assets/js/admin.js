/* ==========================================================================
  ADMIN JS (CLEAN)
  - Theme (system default)
  - Auth + Admin gate (RPC is_admin)
  - Role-based access (super_admin / editor)
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

  const AUTH_REDIRECT_URL = window.location.origin + window.location.pathname;

  /* =========================
    Current user state
  ========================= */
  let currentUserRole = null; // "super_admin" | "editor" | null
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
      const icon = $("#confirmIcon");
      const title = $("#confirmTitle");
      const message = $("#confirmMessage");
      const okBtn = $("#confirmOkBtn");

      if (!modal) {
        resolve(window.confirm(options.message || "Are you sure?"));
        return;
      }

      // Set content
      title.textContent = options.title || "Confirm Action";
      message.textContent =
        options.message || "Are you sure you want to proceed?";

      // Set icon type
      icon.className = "confirm-modal-icon " + (options.type || "danger");
      const iconClass = {
        danger: "fa-trash",
        warning: "fa-triangle-exclamation",
        info: "fa-circle-info",
      }[options.type || "danger"];
      icon.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;

      // Set button style
      okBtn.className =
        options.type === "danger"
          ? "btn-confirm-danger"
          : "btn-confirm-primary";
      okBtn.textContent = options.confirmText || "Confirm";

      modal.classList.add("active");
    });
  }

  function closeConfirmModal(result = false) {
    console.log("[closeConfirmModal] Closing with result:", result);
    const modal = $("#confirmModal");
    if (modal) modal.classList.remove("active");
    if (confirmResolve) {
      confirmResolve(result);
      confirmResolve = null;
    }
  }

  function bindConfirmModal() {
    console.log("[bindConfirmModal] Binding confirmation modal");
    on($("#confirmCancelBtn"), "click", () => closeConfirmModal(false));
    on($("#confirmOkBtn"), "click", () => closeConfirmModal(true));
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

  function bindExport() {
    console.log("[bindExport] Binding export button");
    on($("#exportBtn"), "click", exportProducts);
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

    $$(".tab-btn").forEach((t) => t.classList.remove("active"));
    const tab = $(`[data-auth-tab='${name}']`);
    if (tab) tab.classList.add("active");
  }

  /* =========================
    Password toggle
  ========================= */
  function bindPasswordToggles() {
    console.log("[bindPasswordToggles] Binding password toggle buttons");
    $$(".pw-toggle").forEach((btn) => {
      on(btn, "click", () => {
        const sel = btn.getAttribute("data-target");
        const input = sel ? $(sel) : null;
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
    const isEditor = currentUserRole === "editor";
    console.log(
      "[applyRoleBasedUI] isSuperAdmin:",
      isSuperAdmin,
      "isEditor:",
      isEditor,
    );

    // Update status text with role badge
    if (statusText && statusText.textContent) {
      const currentText = statusText.textContent;
      if (isSuperAdmin && !currentText.includes("Super Admin")) {
        statusText.innerHTML = `${currentText} <span style="color: var(--primary); font-weight: 800; white-space: nowrap;">• Super Admin</span>`;
      } else if (isEditor && !currentText.includes("Editor")) {
        statusText.innerHTML = `${currentText} <span style="color: var(--text-muted); font-weight: 800; white-space: nowrap;">• Editor</span>`;
      }
    }

    // Only super_admin can invite other admins
    if (inviteBtn) {
      inviteBtn.style.display = isSuperAdmin ? "" : "none";
    }

    // Only super_admin can see activity logs
    if (activityNav) {
      activityNav.style.display = isSuperAdmin ? "" : "none";
    }

    // Only super_admin can manage admins
    if (adminsNav) {
      adminsNav.style.display = isSuperAdmin ? "" : "none";
    }

    // Only super_admin can see trash
    if (trashNav) {
      trashNav.style.display = isSuperAdmin ? "" : "none";
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
        inventory: "Inventory",
        orders: "Orders",
        studio: "Product Studio",
        activity: "Activity Logs",
        admins: "Manage Admins",
        trash: "Trash",
      };
      title.textContent = titles[viewId] || viewId;
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

    return `
      <article class="activity-card">
        <div class="activity-icon" style="background: ${color}20; color: ${color};">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="activity-info">
          <p class="activity-title">
            <strong>${adminName}</strong> ${log.action}d ${log.entity}
          </p>
          <p class="activity-detail text-muted">${name}</p>
        </div>
        <time class="activity-time text-muted">${formatRelativeTime(log.created_at)}</time>
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
    return '<span class="role-badge editor">Editor</span>';
  }

  function getAdminCard(admin) {
    const name =
      `${admin.first_name || ""} ${admin.last_name || ""}`.trim() || "No name";
    const canManage =
      admin.id !== currentUserId && currentUserRole === "super_admin";
    const isSuperAdmin = admin.role === "super_admin";

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
            canManage
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
      list.innerHTML = '<p class="text-muted text-center">No admins found</p>';
      return;
    }

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
      list.innerHTML = '<p class="text-muted text-center">Trash is empty</p>';
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
      '<tr><td colspan="7" class="text-center text-muted">Loading orders...</td></tr>';

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
          <td><span class="order-id">#${order.id.slice(0, 8)}</span></td>
          <td>${date}</td>
          <td>
            <div class="order-customer">
              <span class="name">${order.customer_name || "Guest"}</span>
              <span class="email">${order.customer_email || "-"}</span>
            </div>
          </td>
          <td><span class="order-items-count">${itemCount} item${itemCount !== 1 ? "s" : ""}</span></td>
          <td><span class="order-total">₦${(order.total || 0).toLocaleString()}</span></td>
          <td><span class="order-status ${order.status}">${order.status}</span></td>
          <td>
            <div class="order-actions">
              <button type="button" data-view-order="${order.id}" title="View Details">
                <i class="fa-solid fa-eye"></i>
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

  function openOrderModal(orderId) {
    console.log("[openOrderModal] Opening order:", orderId);
    const order = ordersCache.find((o) => o.id === orderId);
    if (!order) return;

    currentOrderId = orderId;
    const modal = $("#orderDetailModal");
    const body = $("#orderModalBody");
    const statusSelect = $("#orderStatusSelect");

    if (!modal || !body) return;

    const items = order.items || [];
    const date = new Date(order.created_at).toLocaleString("en-NG");

    body.innerHTML = `
      <div class="order-detail-section">
        <h4>Order Information</h4>
        <div class="order-detail-row">
          <span>Order ID</span>
          <strong>#${order.id.slice(0, 8)}</strong>
        </div>
        <div class="order-detail-row">
          <span>Date</span>
          <span>${date}</span>
        </div>
        <div class="order-detail-row">
          <span>Payment Method</span>
          <span>${order.payment_method || "Paystack"}</span>
        </div>
        <div class="order-detail-row">
          <span>Payment Reference</span>
          <span>${order.payment_reference || "-"}</span>
        </div>
      </div>

      <div class="order-detail-section">
        <h4>Customer</h4>
        <div class="order-detail-row">
          <span>Name</span>
          <span>${order.customer_name || "Guest"}</span>
        </div>
        <div class="order-detail-row">
          <span>Email</span>
          <span>${order.customer_email || "-"}</span>
        </div>
        <div class="order-detail-row">
          <span>Phone</span>
          <span>${order.customer_phone || "-"}</span>
        </div>
      </div>

      <div class="order-detail-section">
        <h4>Shipping Address</h4>
        <p>${order.shipping_address || "Not provided"}</p>
      </div>

      <div class="order-detail-section">
        <h4>Items (${items.length})</h4>
        ${items
          .map(
            (item) => `
          <div class="order-item-row">
            <img src="${item.image || item.images?.[0] || "assets/img/placeholder.png"}" 
                 alt="${item.name}" class="order-item-img" />
            <div class="order-item-info">
              <div class="order-item-name">${item.name}</div>
              <div class="order-item-meta">Size: ${item.size || "-"} | Qty: ${item.quantity || 1}</div>
            </div>
            <div class="order-item-price">₦${((item.price || 0) * (item.quantity || 1)).toLocaleString()}</div>
          </div>
        `,
          )
          .join("")}
      </div>

      <div class="order-detail-section">
        <h4>Order Summary</h4>
        <div class="order-detail-row">
          <span>Subtotal</span>
          <span>₦${(order.subtotal || order.total || 0).toLocaleString()}</span>
        </div>
        ${
          order.discount
            ? `
          <div class="order-detail-row">
            <span>Discount${order.promo_code ? ` (${order.promo_code})` : ""}</span>
            <span style="color: var(--success);">-₦${order.discount.toLocaleString()}</span>
          </div>
        `
            : ""
        }
        <div class="order-detail-row" style="font-weight: 700;">
          <span>Total</span>
          <span>₦${(order.total || 0).toLocaleString()}</span>
        </div>
      </div>
    `;

    if (statusSelect) statusSelect.value = order.status || "pending";

    modal.hidden = false;
  }

  function closeOrderModal() {
    const modal = $("#orderDetailModal");
    if (modal) modal.hidden = true;
    currentOrderId = null;
  }

  async function updateOrderStatus() {
    if (!currentOrderId) return;

    const statusSelect = $("#orderStatusSelect");
    const newStatus = statusSelect?.value;
    if (!newStatus) return;

    console.log(
      "[updateOrderStatus] Updating order",
      currentOrderId,
      "to",
      newStatus,
    );

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", currentOrderId);

    if (error) {
      console.error("[updateOrderStatus] Error:", error);
      showToast("Failed to update status");
      return;
    }

    await logActivity("update", "order", currentOrderId, { status: newStatus });
    showToast(`Order status updated to ${newStatus}`);
    closeOrderModal();
    await loadOrders();
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

    // Update status
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
    on($("[data-close-imgviewer]"), "click", closeImgViewer);
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

    const count = $$(".chip input:checked").length;
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
        $$(".chip input").forEach((c) => (c.checked = e.target.checked));
      }

      const selected = $$(".chip input:checked").map((cb) => cb.value);
      const hidden = $("#pSizes");
      if (hidden) hidden.value = JSON.stringify(selected);
      updateSizeLabel();
    });

    $$(".chip input").forEach((cb) =>
      on(cb, "change", () => {
        const selected = $$(".chip input:checked").map((x) => x.value);
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
    const hiddenInput = $(`#${fieldId}`);
    const wrap = $(`.ms-wrapper--form[data-field="${fieldId}"]`);
    if (!hiddenInput || !wrap) {
      console.log("[setFormDropdownValue] Element not found for:", fieldId);
      return;
    }

    hiddenInput.value = value;
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

    $$(".chip input").forEach((c) => (c.checked = false));
    $("#pSizes").value = "[]";
    updateSizeLabel();

    // Reset all custom form dropdowns
    [
      "pCategory",
      "pGender",
      "pDeliveryType",
      "pColorMode",
      "pPackType",
    ].forEach((fieldId) => {
      const hiddenInput = $(`#${fieldId}`);
      const wrap = $(`.ms-wrapper--form[data-field="${fieldId}"]`);
      if (hiddenInput) hiddenInput.value = "";
      if (wrap) {
        const label = wrap.querySelector(".ms-label");
        if (label) {
          label.textContent = "Select...";
          label.classList.add("is-idle");
          label.classList.remove("is-selected");
        }
      }
    });

    toggleColorUI();

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

    const sizes = data.sizes || [];
    $$(".chip input").forEach((cb) => (cb.checked = sizes.includes(cb.value)));
    $("#pSizes").value = JSON.stringify(sizes);
    updateSizeLabel();

    // Color mode and pack type with custom dropdowns
    const colorModeValue = data.allow_color_selection ? "open" : "assorted";
    setFormDropdownValue("pColorMode", colorModeValue);
    toggleColorUI();

    setFormDropdownValue("pPackType", data.pack_type || "2-in-1");
    setVal("#pColors", (data.colors || []).join(", "));

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

    // Start session timeout timer
    resetSessionTimer();

    // Log login activity
    await logActivity("login", "session", currentUserId, {
      admin_name: getSessionDisplayName(session),
    });

    await ensureProfileComplete(session);
    ensureDefaultDashboardView();
    await loadInventory();
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
      await enterDashboard(session);
    } catch (err) {
      console.error("[gateWithSession] Exception:", err);
      await supabase.auth.signOut();
      showAuthView("login");
      showToast("Session expired. Please login again.");
    }
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
    on($("#pColorMode"), "change", toggleColorUI);

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
          colors: isOpen
            ? String($("#pColors")?.value || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
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
    Init
  ========================= */
  async function init() {
    console.log("[init] Initializing admin panel");
    bindThemeSystemSync();

    bindPasswordToggles();
    bindNav();
    bindSizesDropdown();
    bindFormSelectDropdowns();
    bindStudioSlider();
    bindViewerModal();
    bindInviteModal();
    bindCompleteProfileModal();
    bindSearchAndFilter();
    bindTrashActions();
    bindAdminsActions();
    bindOrdersActions();
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
      setBtnLoading(btn, true, "Creating...");

      try {
        const firstName = $("#firstName").value.trim();
        const lastName = $("#lastName").value.trim();
        const email = $("#signupEmail").value.trim();
        const password = $("#signupPassword").value;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName } },
        });

        if (error) return setAuthMsg(explainError(error));

        showToast("Account created.");
        if (data?.session) await gateWithSession(data.session, "login");
        else showAuthView("login");
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

    // Recovery event
    supabase.auth.onAuthStateChange((evt) => {
      if (evt === "PASSWORD_RECOVERY") showAuthView("setpw");
    });

    // init UI state
    toggleColorUI();
    updateSizeLabel();
    renderStudioSlider();
    setStudioMode(false);

    await autoGateOnce();
    console.log("[init] Initialization complete");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
