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

  /** Validate email format */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

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

    // Inject requirements UI after the password field's auth-field wrapper
    const group = pwField.closest(".auth-field");
    if (!group) return;

    const reqBox = document.createElement("div");
    reqBox.className = "password-requirements"; // Hidden by default, shown on typing
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

    // Live validation as user types — show requirements only while typing
    pwField.addEventListener("input", () => {
      if (pwField.value.length > 0) {
        reqBox.classList.add("visible");
      } else {
        reqBox.classList.remove("visible");
      }
      checkPasswordStrength(pwField.value);
    });
    pwField.addEventListener("blur", () => {
      // Hide after a short delay if password meets all requirements or is empty
      setTimeout(() => {
        if (!pwField.value.length) reqBox.classList.remove("visible");
      }, 200);
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

    // Reset reCAPTCHA visibility — hidden by CSS, shown via .visible class
    const loginRecaptchaField = loginForm?.querySelector(".recaptcha-field");
    const signupRecaptchaField = signupForm?.querySelector(".recaptcha-field");
    if (loginRecaptchaField) {
      loginRecaptchaField.classList.remove("visible", "verified");
    }
    if (signupRecaptchaField) {
      signupRecaptchaField.classList.remove("visible", "verified");
    }

    // Enable submit buttons
    const loginSubmitBtn = document.querySelector(
      '#loginForm button[type="submit"]',
    );
    const signupSubmitBtn = document.querySelector(
      '#signupForm button[type="submit"]',
    );
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.classList.remove("btn-disabled");
    }
    if (signupSubmitBtn) {
      signupSubmitBtn.disabled = false;
      signupSubmitBtn.classList.remove("btn-disabled");
    }
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
    if (heroTitle)
      heroTitle.textContent = tab === "login" ? "Welcome Back" : "Join Us";
    if (heroSub)
      heroSub.textContent =
        tab === "login"
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

      // Supabase returns a user with empty identities if the email is already registered
      if (
        data?.user &&
        (!data.user.identities || data.user.identities.length === 0)
      ) {
        window.UTILS?.toast?.(
          "An account with this email already exists. Please sign in instead.",
          "error",
        );
        switchTab("login");
        return;
      }

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
   * Forgot Password Modal
   * ───────────────────────────────────────────── */
  function openForgotModal() {
    const backdrop = document.getElementById("forgotBackdrop");
    const modal = document.getElementById("forgotModal");
    if (!backdrop || !modal) return;

    // Reset to form state (not success)
    const formView = modal.querySelector(".forgot-form-view");
    const successView = modal.querySelector(".forgot-success-view");
    if (formView) formView.style.display = "";
    if (successView) successView.style.display = "none";

    // Pre-fill email from login form if available
    const loginEmail = loginForm
      ?.querySelector('[name="email"]')
      ?.value?.trim();
    const forgotEmail = document.getElementById("forgotEmail");
    if (forgotEmail && loginEmail) forgotEmail.value = loginEmail;

    backdrop.classList.add("active");
    modal.classList.add("active");
    setTimeout(() => forgotEmail?.focus(), 300);
  }

  function closeForgotModal() {
    const backdrop = document.getElementById("forgotBackdrop");
    const modal = document.getElementById("forgotModal");
    backdrop?.classList.remove("active");
    modal?.classList.remove("active");
  }

  async function handleForgotPassword(email) {
    const client = getClient();
    if (!client) {
      window.UTILS?.toast?.("Authentication service unavailable", "error");
      return false;
    }

    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/dashboard",
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("🔐 AUTH: Forgot password error:", err);
      window.UTILS?.toast?.(
        err.message || "Failed to send reset link",
        "error",
      );
      return false;
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

    // ─── Login reCAPTCHA: show when user interacts or has saved credentials ───
    let loginRecaptchaRendered = false;
    const loginPasswordInput = loginForm?.querySelector('[name="password"]');

    function showLoginRecaptcha() {
      if (!loginForm) return;
      const field = loginForm.querySelector(".recaptcha-field");
      if (field) {
        field.classList.add("visible");
        field.classList.remove("verified");
      }
      // Render reCAPTCHA widget on first reveal
      if (!loginRecaptchaRendered) {
        const el = document.getElementById("loginRecaptcha");
        if (el && !el.hasChildNodes() && window.grecaptcha) {
          try {
            window.loginRecaptchaWidgetId = grecaptcha.render(
              "loginRecaptcha",
              {
                sitekey: "6LfhBmMsAAAAAMLoUlm0VlYhc4RLJyscH_YVfs6l",
                callback: window.onLoginRecaptchaSuccess,
                "expired-callback": window.onLoginRecaptchaExpired,
              },
            );
          } catch (err) {
            console.log("reCAPTCHA render error:", err);
          }
        }
        loginRecaptchaRendered = true;
      }
    }

    // Show reCAPTCHA on any interaction with login fields
    if (loginPasswordInput) {
      loginPasswordInput.addEventListener("input", () => {
        if (loginPasswordInput.value.length > 0) showLoginRecaptcha();
      });
      loginPasswordInput.addEventListener("focus", showLoginRecaptcha);
    }
    if (loginEmailInput) {
      loginEmailInput.addEventListener("focus", () => {
        // Delayed check — if password already has autofilled value
        setTimeout(() => {
          if (loginPasswordInput?.value?.length > 0) showLoginRecaptcha();
        }, 100);
      });
    }

    // Detect browser-autofilled credentials and show reCAPTCHA
    function checkAutofill() {
      if (!loginForm) return;
      try {
        const pwAutoFilled = loginPasswordInput?.matches?.(":-webkit-autofill");
        if (pwAutoFilled) {
          showLoginRecaptcha();
          return;
        }
      } catch (_) {
        /* selector not supported */
      }
      if (loginPasswordInput?.value?.length > 0) {
        showLoginRecaptcha();
      }
    }

    // Check multiple times since autofill timing varies by browser
    if (loginForm) {
      const autofillTimers = [100, 300, 600, 1200, 2500];
      autofillTimers.forEach((ms) => setTimeout(checkAutofill, ms));
      // Also check when modal opens
      const origOpen = openAuthModal;
      openAuthModal = function (tab) {
        origOpen(tab);
        if (tab === "login" || !tab) {
          autofillTimers.forEach((ms) => setTimeout(checkAutofill, ms));
        }
      };
    }

    // Login form submit
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = loginForm.querySelector('[name="email"]')?.value?.trim();
        const password = loginForm.querySelector('[name="password"]')?.value;

        if (!email || !isValidEmail(email)) {
          window.UTILS?.toast?.("Please enter a valid email address", "error");
          return;
        }

        if (!password) {
          window.UTILS?.toast?.("Please enter your password", "error");
          return;
        }

        // Developer bypass - skip recaptcha for specific accounts
        if (!isDevEmail(email)) {
          // If reCAPTCHA hasn't been shown yet, show it and prompt user
          if (!loginRecaptchaRendered) {
            showLoginRecaptcha();
            window.UTILS?.toast?.(
              "Please complete the reCAPTCHA verification",
              "error",
            );
            return;
          }
          const recaptchaResponse = window.grecaptcha?.getResponse(
            window.loginRecaptchaWidgetId,
          );
          if (!recaptchaResponse) {
            showLoginRecaptcha();
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
          btn.innerHTML =
            '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
          window.grecaptcha?.reset(window.loginRecaptchaWidgetId);
        }
      });
    }

    // ─── Signup reCAPTCHA: show when user types in confirm password ───
    let signupRecaptchaRendered = false;
    const signupConfirmInput = signupForm?.querySelector(
      '[name="confirmPassword"]',
    );
    if (signupConfirmInput) {
      signupConfirmInput.addEventListener("input", () => {
        if (signupConfirmInput.value.length > 0) {
          // Hide password requirements
          const reqBox = document.querySelector(".password-requirements");
          if (reqBox) reqBox.classList.remove("visible");

          // Show reCAPTCHA with animation
          const field = signupForm.querySelector(".recaptcha-field");
          if (field && !field.classList.contains("visible")) {
            field.classList.add("visible");
            if (!signupRecaptchaRendered) {
              const el = document.getElementById("signupRecaptcha");
              if (el && !el.hasChildNodes() && window.grecaptcha) {
                try {
                  window.signupRecaptchaWidgetId = grecaptcha.render(
                    "signupRecaptcha",
                    {
                      sitekey: "6LfhBmMsAAAAAMLoUlm0VlYhc4RLJyscH_YVfs6l",
                      callback: window.onSignupRecaptchaSuccess,
                      "expired-callback": window.onSignupRecaptchaExpired,
                    },
                  );
                } catch (err) {
                  console.log("reCAPTCHA render error:", err);
                }
              }
              signupRecaptchaRendered = true;
            }
          }
        }
      });
    }

    // Signup form submit
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fullName = signupForm.querySelector('[name="fullName"]')?.value;
        const email = signupForm.querySelector('[name="email"]')?.value?.trim();
        const password = signupForm.querySelector('[name="password"]')?.value;
        const confirmPassword = signupForm.querySelector(
          '[name="confirmPassword"]',
        )?.value;

        if (!fullName?.trim()) {
          window.UTILS?.toast?.("Please enter your full name", "error");
          return;
        }

        if (!email || !isValidEmail(email)) {
          window.UTILS?.toast?.("Please enter a valid email address", "error");
          return;
        }

        if (!password) {
          window.UTILS?.toast?.("Please enter a password", "error");
          return;
        }

        if (!confirmPassword) {
          window.UTILS?.toast?.("Please confirm your password", "error");
          return;
        }

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

        // Hide password requirements on submit
        const reqBox = document.querySelector(".password-requirements");
        if (reqBox) reqBox.classList.remove("visible");

        if (email && password) {
          const btn = signupForm.querySelector('button[type="submit"]');
          btn.disabled = true;
          btn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
          await handleSignup(email, password, fullName);
          btn.disabled = false;
          btn.innerHTML =
            '<span>Create Account</span><i class="fa-solid fa-arrow-right"></i>';
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

    // Forgot password link — opens dedicated modal
    const forgotLink = document.getElementById("forgotPasswordLink");
    if (forgotLink) {
      forgotLink.addEventListener("click", (e) => {
        e.preventDefault();
        openForgotModal();
      });
    }

    // Forgot modal event listeners
    const forgotBackdrop = document.getElementById("forgotBackdrop");
    const forgotModal = document.getElementById("forgotModal");
    const forgotClose = document.getElementById("forgotClose");
    const forgotBack = document.getElementById("forgotBack");
    const forgotForm = document.getElementById("forgotForm");

    forgotClose?.addEventListener("click", closeForgotModal);
    forgotBackdrop?.addEventListener("click", closeForgotModal);
    forgotBack?.addEventListener("click", () => {
      closeForgotModal();
      // Small delay then reopen auth modal
      setTimeout(() => openAuthModal("login"), 200);
    });

    forgotForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("forgotEmail");
      const email = emailInput?.value?.trim();
      if (!email || !isValidEmail(email)) {
        window.UTILS?.toast?.("Please enter a valid email address", "error");
        return;
      }

      const btn = forgotForm.querySelector("button[type='submit']");
      if (btn) {
        btn.disabled = true;
        btn.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
      }

      const success = await handleForgotPassword(email);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fa-solid fa-paper-plane"></i> Send Reset Link';
      }

      if (success) {
        // Show success view
        const formView = forgotModal?.querySelector(".forgot-form-view");
        const successView = forgotModal?.querySelector(".forgot-success-view");
        const successEmail = document.getElementById("forgotSuccessEmail");
        if (formView) formView.style.display = "none";
        if (successView) successView.style.display = "block";
        if (successEmail) successEmail.textContent = email;
      }
    });

    // Escape key closes forgot modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && forgotModal?.classList.contains("active")) {
        closeForgotModal();
      }
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
