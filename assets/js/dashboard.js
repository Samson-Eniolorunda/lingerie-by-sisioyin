/**
 * ============================================
 * DASHBOARD MODULE
 * Lingerie by Sisioyin - User Dashboard
 * ============================================
 */
(function () {
  "use strict";
  console.log("📊 DASHBOARD: Module initializing");

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ─────────────────────────────────────────────
   * DOM Elements
   * ───────────────────────────────────────────── */
  const authRequired = $("#authRequired");
  const dashboardLayout = $("#dashboardLayout");
  const signInPromptBtn = $("#signInPromptBtn");
  const dashboardLogout = $("#dashboardLogout");
  const navItems = $$(".dashboard-nav-item[data-section]");
  const sections = $$(".dashboard-section");
  const profileForm = $("#profileForm");

  // Quick references
  const userName = $("#userName");
  const userEmail = $("#userEmail");
  const totalOrders = $("#totalOrders");
  const wishlistCount = $("#wishlistCount");
  const recentOrdersContainer = $("#recentOrdersContainer");
  const allOrdersContainer = $("#allOrdersContainer");

  // Exit if not on dashboard page
  if (!authRequired || !dashboardLayout) {
    console.log("📊 DASHBOARD: Not on dashboard page, skipping");
    return;
  }

  /* ─────────────────────────────────────────────
   * State
   * ───────────────────────────────────────────── */
  let currentUser = null;
  let orders = [];

  /* ─────────────────────────────────────────────
   * Helper to get Supabase client
   * ───────────────────────────────────────────── */
  function getClient() {
    return window.DB?.client || null;
  }

  /* ─────────────────────────────────────────────
   * Section Navigation
   * ───────────────────────────────────────────── */
  function switchSection(sectionId) {
    console.log("📊 DASHBOARD: Switching to section:", sectionId);

    // Update nav active state
    navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.section === sectionId);
    });

    // Show/hide sections
    sections.forEach((section) => {
      section.classList.toggle("active", section.id === `section-${sectionId}`);
    });
  }

  /* ─────────────────────────────────────────────
   * Data Loading
   * ───────────────────────────────────────────── */
  async function loadOrders() {
    const client = getClient();
    if (!client || !currentUser) return;

    try {
      console.log("📊 DASHBOARD: Loading orders");
      const { data, error } = await client
        .from("orders")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      orders = data || [];
      console.log("📊 DASHBOARD: Loaded", orders.length, "orders");

      renderOrders();
    } catch (err) {
      console.error("📊 DASHBOARD: Error loading orders:", err);
    }
  }

  function renderOrders() {
    if (totalOrders) {
      totalOrders.textContent = orders.length;
    }

    const recentOrders = orders.slice(0, 3);
    const tableHTML = createOrdersTable(orders);
    const recentTableHTML = createOrdersTable(recentOrders);

    if (allOrdersContainer) {
      if (orders.length > 0) {
        allOrdersContainer.innerHTML = `
          <div style="overflow-x: auto;">${tableHTML}</div>
        `;
      } else {
        allOrdersContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <i class="fa-solid fa-box-open"></i>
            </div>
            <h4 class="empty-state-title">No orders yet</h4>
            <p class="empty-state-text">When you place orders, they'll appear here.</p>
            <a href="shop.html" class="btn btn-primary">Start Shopping</a>
          </div>
        `;
      }
    }

    if (recentOrdersContainer) {
      if (recentOrders.length > 0) {
        recentOrdersContainer.innerHTML = `
          <div style="overflow-x: auto;">${recentTableHTML}</div>
        `;
      } else {
        recentOrdersContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <i class="fa-solid fa-box-open"></i>
            </div>
            <h4 class="empty-state-title">No orders yet</h4>
            <p class="empty-state-text">When you place orders, they'll appear here.</p>
            <a href="shop.html" class="btn btn-primary">Start Shopping</a>
          </div>
        `;
      }
    }
  }

  function createOrdersTable(ordersList) {
    if (!ordersList || ordersList.length === 0) return "";

    const rows = ordersList
      .map((order) => {
        const date = new Date(order.created_at).toLocaleDateString("en-NG", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const status = order.status || "pending";
        const total = formatPrice(order.total || 0);
        const orderId = order.id?.substring(0, 8) || "N/A";

        return `
          <tr>
            <td><strong>#${orderId}</strong></td>
            <td>${date}</td>
            <td>${total}</td>
            <td><span class="order-status ${status}">${status}</span></td>
            <td>
              <button type="button" class="order-view-btn" data-order="${order.id}">
                View
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      <table class="orders-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Date</th>
            <th>Total</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function loadWishlistCount() {
    try {
      const wishlist = JSON.parse(localStorage.getItem("LBS_WISHLIST") || "[]");
      if (wishlistCount) {
        wishlistCount.textContent = wishlist.length;
      }
    } catch (e) {
      console.error("📊 DASHBOARD: Error loading wishlist:", e);
    }
  }

  /* ─────────────────────────────────────────────
   * Profile Management
   * ───────────────────────────────────────────── */
  function loadProfile() {
    if (!currentUser) return;

    const profileName = $("#profileName");
    const profileEmail = $("#profileEmail");
    const profilePhone = $("#profilePhone");

    if (profileEmail) {
      profileEmail.value = currentUser.email || "";
    }

    if (profileName) {
      profileName.value = currentUser.user_metadata?.full_name || "";
    }

    if (profilePhone) {
      profilePhone.value = currentUser.user_metadata?.phone || "";
    }
  }

  async function saveProfile(formData) {
    const client = getClient();
    if (!client || !currentUser) return;

    try {
      console.log("📊 DASHBOARD: Saving profile");
      const { error } = await client.auth.updateUser({
        data: {
          full_name: formData.fullName,
          phone: formData.phone,
        },
      });

      if (error) throw error;

      window.UTILS?.toast?.("Profile updated successfully!", "success");
    } catch (err) {
      console.error("📊 DASHBOARD: Error saving profile:", err);
      window.UTILS?.toast?.(err.message || "Failed to update profile", "error");
    }
  }

  /* ─────────────────────────────────────────────
   * UI Updates
   * ───────────────────────────────────────────── */
  function showDashboard(user) {
    currentUser = user;

    if (authRequired) authRequired.style.display = "none";
    if (dashboardLayout) dashboardLayout.style.display = "block";

    // Update user info
    if (userName) {
      const name =
        user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
      userName.textContent = name;
    }

    if (userEmail) {
      userEmail.textContent = user.email || "";
    }

    // Load data
    loadProfile();
    loadOrders();
    loadWishlistCount();
  }

  function showNotLoggedIn() {
    currentUser = null;

    if (authRequired) authRequired.style.display = "block";
    if (dashboardLayout) dashboardLayout.style.display = "none";
  }

  /* ─────────────────────────────────────────────
   * Event Listeners
   * ───────────────────────────────────────────── */
  function setupEventListeners() {
    // Sign in prompt
    if (signInPromptBtn) {
      signInPromptBtn.addEventListener("click", () => {
        console.log("📊 DASHBOARD: Sign in button clicked");

        // Try AUTH module first (may be ready after initial load)
        if (window.AUTH?.openModal) {
          console.log("📊 DASHBOARD: Using AUTH.openModal");
          window.AUTH.openModal("login");
          return;
        }

        // Fallback: directly open auth modal by clicking login button
        const loginBtn = document.getElementById("loginBtn");
        if (loginBtn) {
          console.log("📊 DASHBOARD: Clicking loginBtn");
          loginBtn.click();
          return;
        }

        // Last resort: show auth modal directly with correct classes
        const authModal = document.getElementById("authModal");
        const authBackdrop = document.getElementById("authBackdrop");
        if (authModal && authBackdrop) {
          console.log("📊 DASHBOARD: Opening auth modal directly");
          authModal.classList.add("active");
          authBackdrop.classList.add("active");
          document.body.style.overflow = "hidden";

          // Switch to login tab
          const loginTab = authModal.querySelector(
            '.auth-tab[data-tab="login"]',
          );
          const signupTab = authModal.querySelector(
            '.auth-tab[data-tab="signup"]',
          );
          const loginForm = authModal.querySelector("#loginForm");
          const signupForm = authModal.querySelector("#signupForm");

          if (loginTab && loginForm) {
            loginTab.classList.add("active");
            signupTab?.classList.remove("active");
            loginForm.classList.add("active");
            signupForm?.classList.remove("active");
          }
        }
      });
    }

    // Dashboard logout
    if (dashboardLogout) {
      dashboardLogout.addEventListener("click", async () => {
        if (window.AUTH?.logout) {
          await window.AUTH.logout();
          showNotLoggedIn();
        }
      });
    }

    // Navigation
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        switchSection(item.dataset.section);
      });
    });

    // Overview card links
    $$("[data-go]").forEach((card) => {
      card.addEventListener("click", (e) => {
        e.preventDefault();
        switchSection(card.dataset.go);
      });
    });

    // Profile form
    if (profileForm) {
      profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = {
          fullName: $("#profileName")?.value || "",
          phone: $("#profilePhone")?.value || "",
        };

        const btn = profileForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        await saveProfile(formData);

        btn.disabled = false;
        btn.innerHTML = "Save Changes";
      });
    }

    // Order view buttons (delegated)
    document.addEventListener("click", (e) => {
      if (e.target.closest(".order-view-btn")) {
        const orderId = e.target.closest(".order-view-btn").dataset.order;
        viewOrder(orderId);
      }
    });

    // Listen for auth changes
    window.addEventListener("auth:changed", (e) => {
      const user = e.detail?.user;
      if (user) {
        showDashboard(user);
      } else {
        showNotLoggedIn();
      }
    });
  }

  function viewOrder(orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // For now, just show a toast with order info
    // In a full implementation, this could open a modal with order details
    const items = order.items?.length || 0;
    window.UTILS?.toast?.(
      `Order #${orderId.substring(0, 8)}: ${items} item(s), ${formatPrice(order.total)}`,
      "info",
    );
  }

  /* ─────────────────────────────────────────────
   * Initialize
   * ───────────────────────────────────────────── */
  async function init() {
    console.log("📊 DASHBOARD: Initializing");
    setupEventListeners();

    // Check current session
    const client = getClient();
    if (client) {
      try {
        const {
          data: { session },
        } = await client.auth.getSession();

        if (session?.user) {
          console.log("📊 DASHBOARD: User logged in");
          showDashboard(session.user);
        } else {
          console.log("📊 DASHBOARD: No user session");
          showNotLoggedIn();
        }
      } catch (err) {
        console.error("📊 DASHBOARD: Session check error:", err);
        showNotLoggedIn();
      }
    } else {
      // If Supabase isn't loaded yet, wait and retry
      setTimeout(init, 500);
      return;
    }

    console.log("✅ DASHBOARD: Module initialized");
  }

  // Initialize when ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(init, 600);
    });
  } else {
    setTimeout(init, 600);
  }
})();
