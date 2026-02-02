/**
 * ============================================
 * AUTH MODULE
 * Lingerie by Sisioyin - User Authentication
 * ============================================
 */
(function () {
  "use strict";
  console.log("🔐 AUTH: Module initializing");

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ─────────────────────────────────────────────
   * DOM Elements
   * ───────────────────────────────────────────── */
  const authModal = $("#authModal");
  const authClose = $("#authClose");
  const authTabs = $$(".auth-tab");
  const loginForm = $("#loginForm");
  const signupForm = $("#signupForm");
  const loginBtn = $("#loginBtn");
  const logoutBtn = $("#logoutBtn");
  const userMenuBtn = $("#userMenuBtn");
  const userDropdown = $("#userDropdown");

  // If no auth modal, don't proceed
  if (!authModal) {
    console.log("🔐 AUTH: No auth modal found, skipping");
    return;
  }

  /* ─────────────────────────────────────────────
   * State
   * ───────────────────────────────────────────── */
  let currentUser = null;

  /* ─────────────────────────────────────────────
   * Modal Functions
   * ───────────────────────────────────────────── */
  function openAuthModal(tab = "login") {
    console.log("🔐 AUTH: Opening modal, tab:", tab);
    authModal.classList.add("active");
    document.body.style.overflow = "hidden";
    switchTab(tab);
  }

  function closeAuthModal() {
    console.log("🔐 AUTH: Closing modal");
    authModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  function switchTab(tab) {
    authTabs.forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tab);
    });
    if (loginForm) loginForm.classList.toggle("active", tab === "login");
    if (signupForm) signupForm.classList.toggle("active", tab === "signup");
  }

  /* ─────────────────────────────────────────────
   * Helper to get Supabase client
   * ───────────────────────────────────────────── */
  function getClient() {
    return window.DB?.client || null;
  }

  /* ─────────────────────────────────────────────
   * Authentication Functions
   * ───────────────────────────────────────────── */
  async function handleLogin(email, password) {
    console.log("🔐 AUTH: Attempting login for", email);
    const client = getClient();
    if (!client) {
      window.UTILS?.toast?.("Authentication service unavailable", "error");
      return;
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user is an admin - admins should use admin.html
      const { data: profile } = await client
        .from("profiles")
        .select("is_admin")
        .eq("id", data.user.id)
        .single();

      if (profile?.is_admin) {
        // Sign out and redirect admin to admin page
        await client.auth.signOut();
        window.UTILS?.toast?.(
          "Admin accounts should login through the admin portal",
          "warning",
        );
        closeAuthModal();
        setTimeout(() => {
          window.location.href = "admin.html";
        }, 1500);
        return;
      }

      console.log("🔐 AUTH: Login successful");
      window.UTILS?.toast?.("Welcome back!", "success");
      closeAuthModal();
      updateAuthUI(data.user);
    } catch (err) {
      console.error("🔐 AUTH: Login error:", err);
      window.UTILS?.toast?.(err.message || "Login failed", "error");
    }
  }

  async function handleSignup(email, password, fullName) {
    console.log("🔐 AUTH: Attempting signup for", email);
    const client = getClient();
    if (!client) {
      window.UTILS?.toast?.("Authentication service unavailable", "error");
      return;
    }

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      console.log("🔐 AUTH: Signup successful");
      window.UTILS?.toast?.(
        "Account created! Please check your email to verify.",
        "success",
      );
      closeAuthModal();
    } catch (err) {
      console.error("🔐 AUTH: Signup error:", err);
      window.UTILS?.toast?.(err.message || "Signup failed", "error");
    }
  }

  async function handleLogout() {
    console.log("🔐 AUTH: Logging out");
    const client = getClient();
    if (!client) return;

    try {
      await client.auth.signOut();
      window.UTILS?.toast?.("Logged out successfully", "info");
      updateAuthUI(null);
    } catch (err) {
      console.error("🔐 AUTH: Logout error:", err);
    }
  }

  async function handleGoogleLogin() {
    console.log("🔐 AUTH: Attempting Google login");
    const client = getClient();
    if (!client) {
      window.UTILS?.toast?.("Authentication service unavailable", "error");
      return;
    }

    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error("🔐 AUTH: Google login error:", err);
      window.UTILS?.toast?.(err.message || "Google login failed", "error");
    }
  }

  /* ─────────────────────────────────────────────
   * UI Updates
   * ───────────────────────────────────────────── */
  function updateAuthUI(user) {
    currentUser = user;

    if (loginBtn) {
      loginBtn.hidden = !!user;
    }

    if (logoutBtn) {
      logoutBtn.hidden = !user;
    }

    if (userMenuBtn) {
      userMenuBtn.hidden = !user;
      if (user) {
        const initial = (user.email || "U")[0].toUpperCase();
        userMenuBtn.innerHTML = `<span class="user-avatar">${initial}</span>`;
      }
    }

    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user } }));
  }

  /* ─────────────────────────────────────────────
   * Event Listeners
   * ───────────────────────────────────────────── */
  function setupEventListeners() {
    // Close modal
    if (authClose) {
      authClose.addEventListener("click", closeAuthModal);
    }

    // Click outside to close
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) closeAuthModal();
    });

    // Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && authModal.classList.contains("active")) {
        closeAuthModal();
      }
    });

    // Tab switching
    authTabs.forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // Login form
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Verify reCAPTCHA
        const recaptchaResponse = window.grecaptcha?.getResponse(
          window.loginRecaptchaWidgetId,
        );
        if (!recaptchaResponse) {
          window.UTILS?.toast?.(
            "Please complete the reCAPTCHA verification",
            "error",
          );
          return;
        }

        const email = loginForm.querySelector('[name="email"]')?.value;
        const password = loginForm.querySelector('[name="password"]')?.value;
        if (email && password) {
          const btn = loginForm.querySelector('button[type="submit"]');
          btn.disabled = true;
          btn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
          await handleLogin(email, password);
          btn.disabled = false;
          btn.innerHTML = "Sign In";
          // Reset reCAPTCHA after submission
          window.grecaptcha?.reset(window.loginRecaptchaWidgetId);
        }
      });
    }

    // Signup form
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Verify reCAPTCHA
        const recaptchaResponse = window.grecaptcha?.getResponse(
          window.signupRecaptchaWidgetId,
        );
        if (!recaptchaResponse) {
          window.UTILS?.toast?.(
            "Please complete the reCAPTCHA verification",
            "error",
          );
          return;
        }

        const fullName = signupForm.querySelector('[name="fullName"]')?.value;
        const email = signupForm.querySelector('[name="email"]')?.value;
        const password = signupForm.querySelector('[name="password"]')?.value;
        const confirmPassword = signupForm.querySelector(
          '[name="confirmPassword"]',
        )?.value;

        if (password !== confirmPassword) {
          window.UTILS?.toast?.("Passwords do not match", "error");
          return;
        }

        if (password.length < 6) {
          window.UTILS?.toast?.(
            "Password must be at least 6 characters",
            "error",
          );
          return;
        }

        if (email && password) {
          const btn = signupForm.querySelector('button[type="submit"]');
          btn.disabled = true;
          btn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
          await handleSignup(email, password, fullName);
          btn.disabled = false;
          btn.innerHTML = "Create Account";
          // Reset reCAPTCHA after submission
          window.grecaptcha?.reset(window.signupRecaptchaWidgetId);
        }
      });
    }

    // Login button
    if (loginBtn) {
      loginBtn.addEventListener("click", () => openAuthModal("login"));
    }

    // User menu button - go to dashboard
    if (userMenuBtn) {
      userMenuBtn.addEventListener("click", () => {
        window.location.href = "dashboard.html";
      });
    }

    // Logout button
    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }

    // Google login buttons
    $$(".google-login-btn").forEach((btn) => {
      btn.addEventListener("click", handleGoogleLogin);
    });
  }

  /* ─────────────────────────────────────────────
   * Initialize
   * ───────────────────────────────────────────── */
  async function init() {
    console.log("🔐 AUTH: Initializing");
    setupEventListeners();

    // Check current session
    const client = getClient();
    if (client) {
      try {
        const {
          data: { session },
        } = await client.auth.getSession();
        if (session?.user) {
          console.log("🔐 AUTH: Existing session found");
          updateAuthUI(session.user);
        }

        // Listen for auth changes
        client.auth.onAuthStateChange((event, session) => {
          console.log("🔐 AUTH: Auth state changed:", event);
          updateAuthUI(session?.user || null);
        });
      } catch (err) {
        console.error("🔐 AUTH: Session check error:", err);
      }
    }

    console.log("✅ AUTH: Module initialized");
  }

  // Expose functions globally
  window.AUTH = {
    openModal: openAuthModal,
    closeModal: closeAuthModal,
    logout: handleLogout,
    getUser: () => currentUser,
  };

  // Initialize when Supabase is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }
})();
