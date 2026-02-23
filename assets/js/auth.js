/**
 * ============================================
 * AUTH MODULE
 * Lingeries by Sisioyin - User Authentication
 * ============================================
 */
(function () {
  "use strict";
  console.log("🔐 AUTH: Module initializing");

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /** Validate email format */
  function isValidEmail(email) {
    console.log("[isValidEmail]", email);
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
    console.log("[initPasswordRequirements]");
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
      // Hide after a short delay so click-on-confirmPw works
      setTimeout(() => {
        reqBox.classList.remove("visible");
      }, 200);
    });
  }

  function checkPasswordStrength(pw) {
    console.log("[checkPasswordStrength]", pw);
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

  /* ── Mobile keyboard: reposition auth modal when keyboard appears ── */
  (function initAuthModalKeyboardHandler() {
    if (!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return;
    if (!window.visualViewport) return;

    const adjustModal = () => {
      if (!authModal || !authModal.classList.contains("active")) return;
      const vv = window.visualViewport;
      // When keyboard opens, visualViewport.height shrinks
      const offsetTop = vv.offsetTop;
      const viewH = vv.height;
      authModal.style.top = offsetTop + viewH / 2 + "px";
    };

    const resetModal = () => {
      if (!authModal) return;
      authModal.style.top = "";
    };

    window.visualViewport.addEventListener("resize", adjustModal);
    window.visualViewport.addEventListener("scroll", adjustModal);

    // Reset when modal closes or no focus
    document.addEventListener("focusout", () => {
      setTimeout(resetModal, 100);
    });
  })();

  function switchTab(tab) {
    console.log("[switchTab]", tab);
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
    console.log("[getClient]");
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

      // Check if account is suspended or banned
      const { data: profile } = await client
        .from("profiles")
        .select("account_status")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.account_status === "deleted") {
        await client.auth.signOut();
        window.UTILS?.toast?.(
          "This account has been deleted. If you believe this is an error, please contact support.",
          "error",
        );
        return;
      }
      if (profile?.account_status === "banned") {
        await client.auth.signOut();
        window.UTILS?.toast?.(
          "Your account has been deactivated. Please contact support.",
          "error",
        );
        return;
      }
      if (profile?.account_status === "suspended") {
        await client.auth.signOut();
        window.UTILS?.toast?.(
          "Your account is temporarily suspended. Please contact support.",
          "error",
        );
        return;
      }

      // Admin accounts can now login to shop as well
      console.log("🔐 AUTH: Login successful");
      window.UTILS?.toast?.("Welcome back!", "success");
      closeAuthModal();
      updateAuthUI(data.user);

      // Cross-device sync: pull & merge remote data
      window.SYNC?.onLogin?.();
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
          emailRedirectTo: (window.APP_CONFIG?.SITE_URL || window.location.origin) + "/home",
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

      // Send welcome email to new customer (fire-and-forget)
      try {
        fetch(
          `${window.APP_CONFIG?.SUPABASE_URL || ""}/functions/v1/send-user-welcome`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: fullName || "Customer",
              email: email,
            }),
          },
        );
      } catch (_) {
        /* non-critical */
      }
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
      // Clear session-specific storage (allows welcome animation on next login)
      sessionStorage.removeItem("dashWelcomeShown");

      // Show logout overlay
      const overlay = document.createElement("div");
      overlay.className = "auth-logout-overlay";
      overlay.innerHTML = `
        <div class="auth-logout-content">
          <div class="auth-logout-icon"><i class="fa-solid fa-right-from-bracket"></i></div>
          <p class="auth-logout-text">Signing out...</p>
        </div>
      `;
      document.body.appendChild(overlay);
      // Allow time for the user to see the overlay
      await new Promise((r) => setTimeout(r, 1200));
      await client.auth.signOut();
      window.SYNC?.onLogout?.();
      window.UTILS?.toast?.("Logged out successfully", "info");
      updateAuthUI(null);
      // Fade out and remove
      overlay.classList.add("fade-out");
      setTimeout(() => overlay.remove(), 500);
    } catch (err) {
      console.error("🔐 AUTH: Logout error:", err);
      document.querySelector(".auth-logout-overlay")?.remove();
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
          redirectTo: window.APP_CONFIG?.SITE_URL || window.location.origin,
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
    console.log("[openForgotModal]");
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
    console.log("[closeForgotModal]");
    const backdrop = document.getElementById("forgotBackdrop");
    const modal = document.getElementById("forgotModal");
    backdrop?.classList.remove("active");
    modal?.classList.remove("active");
  }

  async function handleForgotPassword(email) {
    console.log("[handleForgotPassword]", email);
    const client = getClient();
    if (!client) {
      window.UTILS?.toast?.("Authentication service unavailable", "error");
      return false;
    }

    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo:
          (window.APP_CONFIG?.SITE_URL || window.location.origin) +
          "/dashboard",
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
   * UI Updates
   * ───────────────────────────────────────────── */
  function getInitials(user) {
    console.log("[getInitials]", user);
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
    console.log("[updateAuthUI]", user);
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
    console.log("[setupPasswordToggles]");
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
    console.log("[setupEventListeners]");
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

    // Scroll focused input into view inside modal on mobile
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      authModal.addEventListener("focusin", (e) => {
        const el = e.target;
        if (!el || !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
          return;
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 350);
      });
    }

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

    // ─── Login reCAPTCHA: show when user interacts or has saved credentials ───
    let loginRecaptchaRendered = false;
    const loginPasswordInput = loginForm?.querySelector('[name="password"]');
    const loginEmailInput = loginForm?.querySelector('[name="email"]');

    function showLoginRecaptcha() {
      console.log("[showLoginRecaptcha]");
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
      console.log("[checkAutofill]");
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

        // reCAPTCHA verification
        {
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

        const firstName = signupForm.querySelector('[name="firstName"]')?.value;
        const lastName = signupForm.querySelector('[name="lastName"]')?.value;
        const fullName =
          `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
        const email = signupForm.querySelector('[name="email"]')?.value?.trim();
        const password = signupForm.querySelector('[name="password"]')?.value;
        const confirmPassword = signupForm.querySelector(
          '[name="confirmPassword"]',
        )?.value;

        if (!firstName?.trim()) {
          window.UTILS?.toast?.("Please enter your first name", "error");
          return;
        }

        if (!lastName?.trim()) {
          window.UTILS?.toast?.("Please enter your last name", "error");
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
   * Expired Link View
   * ───────────────────────────────────────────── */
  function showExpiredLinkView(errorMessage) {
    console.log("🔐 AUTH: Showing expired link view");

    // Create expired modal overlay
    const overlay = document.createElement("div");
    overlay.className = "expired-link-modal";
    overlay.innerHTML = `
      <div class="expired-link-content">
        <div class="expired-link-icon">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </div>
        <h2>Link Expired</h2>
        <p class="expired-link-text">${escapeHtml(errorMessage) || "This link has expired or is no longer valid."}</p>
        <p class="expired-link-subtext">Links expire after 1 hour for security reasons.</p>
        <div class="expired-link-actions">
          <div id="resendConfirmGroupShop" style="display:none; width:100%;">
            <input type="email" id="resendConfirmEmailShop" class="form-control" placeholder="Enter your email address" style="margin-bottom:0.75rem;"/>
            <button type="button" class="btn btn-primary btn-block" id="resendConfirmBtnShop">
              <i class="fa-solid fa-paper-plane"></i>
              Resend Confirmation Email
            </button>
          </div>
          <button type="button" class="btn btn-primary btn-block" id="requestNewLinkBtnShop">
            <i class="fa-solid fa-envelope"></i>
            Request Password Reset
          </button>
          <button type="button" class="btn btn-outline btn-block" id="backToHomeBtnShop">
            <i class="fa-solid fa-arrow-left"></i>
            Back to Home
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => overlay.classList.add("active"));

    // Bind buttons
    const requestBtn = overlay.querySelector("#requestNewLinkBtnShop");
    const resendGroup = overlay.querySelector("#resendConfirmGroupShop");
    const resendBtn = overlay.querySelector("#resendConfirmBtnShop");
    const backBtn = overlay.querySelector("#backToHomeBtnShop");

    // Detect if this was a signup confirmation error (error_code=otp_expired typically)
    const isSignupExpiry = (errorMessage || "").toLowerCase().includes("expired");
    if (isSignupExpiry && resendGroup && requestBtn) {
      resendGroup.style.display = "";
      requestBtn.style.display = "none";
    }

    if (resendBtn) {
      resendBtn.addEventListener("click", async () => {
        const emailInput = overlay.querySelector("#resendConfirmEmailShop");
        const email = emailInput?.value?.trim();
        if (!email) {
          window.UTILS?.toast?.("Please enter your email address.", "error");
          return;
        }
        const origHTML = resendBtn.innerHTML;
        resendBtn.disabled = true;
        resendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
        try {
          const cl = getClient();
          if (!cl) throw new Error("Auth service unavailable");
          const { error } = await cl.auth.resend({
            type: "signup",
            email,
            options: { emailRedirectTo: (window.APP_CONFIG?.SITE_URL || window.location.origin) + "/home" },
          });
          if (error) throw error;
          window.UTILS?.toast?.("Confirmation email resent! Check your inbox.", "success");
          overlay.remove();
        } catch (err) {
          console.error("🔐 AUTH: Resend confirmation error:", err);
          window.UTILS?.toast?.(err.message || "Failed to resend email.", "error");
        } finally {
          resendBtn.disabled = false;
          resendBtn.innerHTML = origHTML;
        }
      });
    }

    if (requestBtn) {
      requestBtn.addEventListener("click", () => {
        overlay.remove();
        // Open auth modal with forgot password tab
        if (window.AUTH?.openModal) {
          window.AUTH.openModal("login");
          // Trigger forgot password view after modal opens
          setTimeout(() => {
            const forgotLink = document.getElementById("forgotPasswordLink");
            if (forgotLink) forgotLink.click();
          }, 100);
        }
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        overlay.remove();
        window.location.href = window.location.origin + "/home";
      });
    }
  }

  /* ─────────────────────────────────────────────
   * Email Verified Success View
   * ───────────────────────────────────────────── */
  function showEmailVerifiedView(userEmail) {
    console.log("🔐 AUTH: Showing email verified success view");

    // Create success modal overlay
    const overlay = document.createElement("div");
    overlay.className = "email-verified-modal";
    overlay.innerHTML = `
      <div class="email-verified-content">
        <div class="email-verified-icon">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h2>Email Verified!</h2>
        <p class="email-verified-text">${userEmail ? `<strong>${escapeHtml(userEmail)}</strong> has been verified.` : "Your email has been verified."}</p>
        <p class="email-verified-redirect">Redirecting to your dashboard<span class="loading-dots"></span></p>
        <div class="email-verified-progress">
          <div class="email-verified-progress-bar"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => overlay.classList.add("active"));

    // Redirect to dashboard after 3 seconds
    setTimeout(() => {
      window.location.href = window.location.origin + "/dashboard";
    }, 3000);
  }

  function escapeHtml(str) {
    console.log("[escapeHtml]", str);
    if (!str) return "";
    return str.replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );
  }

  // Send welcome email to new user
  async function sendUserWelcomeEmail(session) {
    console.log("[sendUserWelcomeEmail]", session);
    if (!session?.user?.email) return;
    try {
      const supabaseUrl = window.APP_CONFIG?.SUPABASE_URL;
      if (!supabaseUrl) return;

      console.log("🔐 AUTH: Sending welcome email to:", session.user.email);
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-user-welcome`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: session.user.email,
            name:
              session.user.user_metadata?.full_name ||
              session.user.email.split("@")[0],
          }),
        },
      );

      if (response.ok) {
        console.log("🔐 AUTH: Welcome email sent successfully");
      } else {
        console.warn("🔐 AUTH: Welcome email failed:", await response.text());
      }
    } catch (err) {
      console.warn("🔐 AUTH: Welcome email error:", err);
    }
  }

  /* ─────────────────────────────────────────────
   * Initialize
   * ───────────────────────────────────────────── */
  async function init() {
    console.log("🔐 AUTH: Initializing");
    setupEventListeners();
    initPasswordRequirements();

    // Capture hash early before Supabase clears it
    const hash = window.__RECOVERY_HASH__ || window.location.hash;
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const authType = hashParams.get("type");
    const errorCode = hashParams.get("error_code");

    // Handle expired/invalid link errors
    if (errorCode) {
      const errorDesc =
        hashParams.get("error_description") || "Link expired or invalid";
      console.log("🔐 AUTH: Error in hash:", errorCode, errorDesc);
      // Clear hash
      history.replaceState(null, "", window.location.pathname);
      // Show expired link view instead of just a toast
      showExpiredLinkView(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
      return;
    }

    // Handle PKCE code-exchange redirect (?code=...)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("code") && !window.location.pathname.includes("admin")) {
      console.log("🔐 AUTH: PKCE code-exchange redirect detected");
      const client = getClient();
      if (client) {
        try {
          const { data, error } = await client.auth.exchangeCodeForSession(urlParams.get("code"));
          if (error) {
            console.error("🔐 AUTH: PKCE code exchange failed:", error);
            showExpiredLinkView(error.message || "This link has expired or is no longer valid.");
          } else if (data?.session?.user) {
            console.log("🔐 AUTH: PKCE session established");
            updateAuthUI(data.session.user);
            // Check if admin
            const { data: profile } = await client
              .from("profiles")
              .select("is_admin")
              .eq("id", data.session.user.id)
              .single();
            if (profile?.is_admin) {
              window.location.href = window.location.origin + "/admin";
              return;
            }
            sendUserWelcomeEmail(data.session);
            showEmailVerifiedView(data.session.user.email);
          }
        } catch (err) {
          console.error("🔐 AUTH: PKCE exchange error:", err);
        }
      }
      // Clean URL
      history.replaceState(null, "", window.location.pathname);
      return;
    }

    // Handle email confirmation (type=signup means email was just verified)
    if (authType === "signup" && !window.location.pathname.includes("admin")) {
      console.log("🔐 AUTH: Email confirmation detected");
      // Clear the hash to prevent re-processing
      history.replaceState(null, "", window.location.pathname);

      // Get session and check if user is admin
      const client = getClient();
      if (client) {
        try {
          const {
            data: { session },
          } = await client.auth.getSession();
          if (session?.user) {
            // Check if user is an admin - redirect to admin site
            const { data: profile } = await client
              .from("profiles")
              .select("is_admin")
              .eq("id", session.user.id)
              .single();

            if (profile?.is_admin) {
              console.log(
                "🔐 AUTH: Admin user verified on shop site, redirecting to admin",
              );
              window.location.href = window.location.origin + "/admin";
              return;
            }

            // Regular customer - send welcome email and show success
            sendUserWelcomeEmail(session);
            showEmailVerifiedView(session.user.email);
            return; // Don't continue with normal init
          }
        } catch (err) {
          console.error("🔐 AUTH: Email verification session error:", err);
        }
      }
    }

    // If URL hash contains type=recovery, redirect to dashboard (unless already there)
    if (
      hash &&
      hash.includes("type=recovery") &&
      !window.location.pathname.includes("dashboard")
    ) {
      console.log("🔐 AUTH: Recovery hash detected, redirecting to dashboard");
      // Don't append raw hash — detectSessionInUrl already consumed the tokens.
      // Pass a query flag so dashboard knows to open the set-password modal.
      window.location.href = window.location.origin + "/dashboard?setpw=1";
      return;
    }

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

          // Only update UI for explicit sign-in/sign-out events
          // Ignore TOKEN_REFRESHED with null session (mobile background/resume)
          if (event === "PASSWORD_RECOVERY" && session?.user) {
            // Redirect to dashboard where the set-password modal lives
            // Skip if already on dashboard (dashboard.js handles it there)
            const onDashboard = window.location.pathname.includes("dashboard");
            if (!onDashboard) {
              console.log(
                "🔐 AUTH: Password recovery detected, redirecting to dashboard",
              );
              window.location.href =
                window.location.origin + "/dashboard?setpw=1";
              return;
            }
          } else if (event === "SIGNED_IN" && session?.user) {
            updateAuthUI(session.user);
            window.SYNC?.onLogin?.();
            // Link current visit to the newly-signed-in user
            if (typeof window.Analytics?.linkVisitToUser === "function") {
              window.Analytics.linkVisitToUser();
            }
          } else if (event === "SIGNED_OUT") {
            updateAuthUI(null);
          } else if (event === "TOKEN_REFRESHED" && session?.user) {
            // Token refreshed successfully, keep user logged in
            updateAuthUI(session.user);
          } else if (event === "USER_UPDATED" && session?.user) {
            updateAuthUI(session.user);
          }
          // For TOKEN_REFRESHED with null session — do NOT log out,
          // the stored session in localStorage may still be valid
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
