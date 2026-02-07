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
  const authTabs = $$(".auth-tab[data-tab]");
  const loginForm = $("#loginForm");
  const signupForm = $("#signupForm");
  const loginBtn = $("#loginBtn");

  // If no auth modal, don't proceed
  if (!authModal) {
    console.log("🔐 AUTH: No auth modal found, skipping");
    return;
  }

  /* ─────────────────────────────────────────────
   * Password Requirements UI
   * ───────────────────────────────────────────── */
  const PW_RULES = [
    {
      key: "length",
      label: "At least 8 characters",
      test: (p) => p.length >= 8,
    },
    {
      key: "upper",
      label: "Uppercase letter (A-Z)",
      test: (p) => /[A-Z]/.test(p),
    },
    {
      key: "lower",
      label: "Lowercase letter (a-z)",
      test: (p) => /[a-z]/.test(p),
    },
    { key: "number", label: "Number (0-9)", test: (p) => /\d/.test(p) },
    {
      key: "special",
      label: "Special character (!@#$…)",
      test: (p) => /[^A-Za-z0-9]/.test(p),
    },
  ];

  function initPasswordRequirements() {
    const pwField = $("#signupPassword");
    if (!pwField) return;

    // Inject requirements UI after the password field's form-group
    const group = pwField.closest(".form-group");
    if (!group) return;

    const reqBox = document.createElement("div");
    reqBox.className = "password-requirements";
    reqBox.innerHTML = `
      <div class="pw-strength-bar"><div class="pw-strength-fill" id="pwStrengthFill"></div></div>
      <ul class="pw-rules">
        ${PW_RULES.map(
          (r) => `<li class="pw-rule" data-rule="${r.key}">
          <i class="fa-solid fa-circle-xmark"></i> ${r.label}
        </li>`,
        ).join("")}
      </ul>`;
    group.after(reqBox);

    pwField.addEventListener("input", () =>
      checkPasswordStrength(pwField.value),
    );
    pwField.addEventListener("focus", () => reqBox.classList.add("visible"));
    pwField.addEventListener("blur", () => {
      if (!pwField.value) reqBox.classList.remove("visible");
    });
  }

  function checkPasswordStrength(pw) {
    let passed = 0;
    PW_RULES.forEach((rule) => {
      const el = document.querySelector(`.pw-rule[data-rule="${rule.key}"]`);
      if (!el) return;
      const ok = rule.test(pw);
      if (ok) passed++;
      el.classList.toggle("met", ok);
      el.querySelector("i").className = ok
        ? "fa-solid fa-circle-check"
        : "fa-solid fa-circle-xmark";
    });

    // Strength bar
    const fill = $("#pwStrengthFill");
    if (fill) {
      const pct = (passed / PW_RULES.length) * 100;
      fill.style.width = pct + "%";
      fill.className =
        "pw-strength-fill " +
        (pct <= 40 ? "weak" : pct <= 70 ? "fair" : "strong");
    }
    return passed === PW_RULES.length;
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

    // Disable submit buttons initially
    const loginBtn = document.querySelector('#loginForm button[type="submit"]');
    const signupBtn = document.querySelector(
      '#signupForm button[type="submit"]',
    );
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.classList.add("btn-disabled");
    }
    if (signupBtn) {
      signupBtn.disabled = true;
      signupBtn.classList.add("btn-disabled");
    }

    // Re-render reCAPTCHA after modal is visible
    setTimeout(() => {
      if (window.grecaptcha) {
        try {
          const loginRecaptcha = document.getElementById("loginRecaptcha");
          const signupRecaptcha = document.getElementById("signupRecaptcha");

          // Only render if not already rendered
          if (loginRecaptcha && !loginRecaptcha.hasChildNodes()) {
            window.loginRecaptchaWidgetId = grecaptcha.render(
              "loginRecaptcha",
              {
                sitekey: "6LfhBmMsAAAAAMLoUlm0VlYhc4RLJyscH_YVfs6l",
                callback: window.onLoginRecaptchaSuccess,
                "expired-callback": window.onLoginRecaptchaExpired,
              },
            );
          }
          if (signupRecaptcha && !signupRecaptcha.hasChildNodes()) {
            window.signupRecaptchaWidgetId = grecaptcha.render(
              "signupRecaptcha",
              {
                sitekey: "6LfhBmMsAAAAAMLoUlm0VlYhc4RLJyscH_YVfs6l",
                callback: window.onSignupRecaptchaSuccess,
                "expired-callback": window.onSignupRecaptchaExpired,
              },
            );
          }
        } catch (e) {
          console.log("🔐 AUTH: reCAPTCHA render error:", e);
        }
      }
    }, 100);
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

    // Update hero text
    const heroTitle = document.getElementById("authHeroTitle");
    const heroSub = document.getElementById("authHeroSub");
    if (heroTitle) heroTitle.textContent = tab === "login" ? "Welcome Back" : "Join Us";
    if (heroSub) heroSub.textContent = tab === "login"
      ? "Sign in to your account to continue"
      : "Create an account to get started";

    // Move tab indicator
    const indicator = document.querySelector(".auth-tab-indicator");
    if (indicator) {
      const idx = tab === "signup" ? 1 : 0;
      indicator.style.transform = `translateX(${idx * 100}%)`;
    }
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

      // Admin accounts can now login to shop as well
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
   * Developer Account Detection
   * ───────────────────────────────────────────── */
  const DEV_EMAILS = [
    "dev@lingerie.com",
    "admin@lingerie.com",
    "test@test.com",
  ];

  function isDevEmail(email) {
    return DEV_EMAILS.some(
      (devEmail) => email?.toLowerCase().trim() === devEmail,
    );
  }

  /* ─────────────────────────────────────────────
   * UI Updates
   * ───────────────────────────────────────────── */
  function getInitials(user) {
    const name = user?.user_metadata?.full_name || "";
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2)
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return parts[0][0]?.toUpperCase() || "U";
    }
    return (user?.email?.[0] || "U").toUpperCase();
  }

  function updateAuthUI(user) {
    currentUser = user;

    if (loginBtn) {
      if (user) {
        // Swap icon to initials and navigate to dashboard on click
        loginBtn.hidden = false;
        loginBtn.innerHTML = `<span class="user-initials">${getInitials(user)}</span>`;
        loginBtn.setAttribute("aria-label", "My Account");
        loginBtn.onclick = (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          window.location.href = "/dashboard";
        };
      } else {
        loginBtn.hidden = false;
        loginBtn.innerHTML = '<i class="fa-solid fa-user"></i>';
        loginBtn.setAttribute("aria-label", "Sign in");
        loginBtn.onclick = null;
      }
    }

    // Update mobile drawer user section
    const drawerName = document.querySelector(".drawer-user-name");
    const drawerEmail = document.querySelector(".drawer-user-email");
    const drawerAvatar = document.querySelector(".drawer-user-avatar");
    if (user) {
      const name =
        user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
      if (drawerName) drawerName.textContent = name;
      if (drawerEmail) drawerEmail.textContent = user.email || "";
      if (drawerAvatar)
        drawerAvatar.innerHTML = `<span class="user-initials">${getInitials(user)}</span>`;
    } else {
      if (drawerName) drawerName.textContent = "My Account";
      if (drawerEmail) drawerEmail.textContent = "Sign in for best experience";
      if (drawerAvatar)
        drawerAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
    }

    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user } }));
  }

  /* ─────────────────────────────────────────────
   * Password Toggle Setup
   * ───────────────────────────────────────────── */
  function setupPasswordToggles() {
    // Find all password inputs in auth modal
    const passwordInputs =
      authModal?.querySelectorAll('input[type="password"]') || [];

    passwordInputs.forEach((input) => {
      // Skip if already wrapped
      if (input.parentElement.classList.contains("password-wrapper")) return;

      // Create wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "password-wrapper";

      // Insert wrapper before input, then move input into wrapper
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      // Create toggle button
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "password-toggle";
      toggle.setAttribute("aria-label", "Toggle password visibility");
      toggle.innerHTML = '<i class="fa-regular fa-eye"></i>';
      wrapper.appendChild(toggle);

      // Add click handler
      toggle.addEventListener("click", () => {
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        toggle.innerHTML = isPassword
          ? '<i class="fa-regular fa-eye-slash"></i>'
          : '<i class="fa-regular fa-eye"></i>';
      });
    });
  }

  /* ─────────────────────────────────────────────
   * Event Listeners
   * ───────────────────────────────────────────── */
  function setupEventListeners() {
    // Setup password toggles
    setupPasswordToggles();

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

    // Email field change - enable button for dev accounts
    const loginEmailInput = loginForm?.querySelector('[name="email"]');
    if (loginEmailInput) {
      loginEmailInput.addEventListener("input", (e) => {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        if (isDevEmail(e.target.value)) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("btn-disabled");
        }
      });
    }

    // Tab switching
    authTabs.forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // Login form
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = loginForm.querySelector('[name="email"]')?.value;
        const password = loginForm.querySelector('[name="password"]')?.value;

        // Developer bypass - skip recaptcha for specific accounts
        if (!isDevEmail(email)) {
          // Verify reCAPTCHA for non-dev accounts
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
        }

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

        if (!checkPasswordStrength(password)) {
          window.UTILS?.toast?.(
            "Password does not meet all requirements",
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

    // Login button — only opens auth modal if not logged in
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        if (!currentUser) openAuthModal("login");
      });
    }

    // Google login buttons
    $$(".google-login-btn").forEach((btn) => {
      btn.addEventListener("click", handleGoogleLogin);
    });

    // Password toggle buttons
    $$(".pw-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetSel = btn.dataset.target;
        const input = targetSel
          ? $(targetSel)
          : btn.previousElementSibling?.previousElementSibling;
        if (input && input.tagName === "INPUT") {
          const isPassword = input.type === "password";
          input.type = isPassword ? "text" : "password";
          const icon = btn.querySelector("i");
          if (icon) {
            icon.classList.toggle("fa-eye", !isPassword);
            icon.classList.toggle("fa-eye-slash", isPassword);
          }
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
   * Initialize
   * ───────────────────────────────────────────── */
  async function init() {
    console.log("🔐 AUTH: Initializing");
    setupEventListeners();
    initPasswordRequirements();

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
