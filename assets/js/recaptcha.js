/**
 * reCAPTCHA Initialization
 * Moved from inline scripts for better code organization
 */

// Callback when login reCAPTCHA is completed
function onLoginRecaptchaSuccess() {
  const loginBtn = document.querySelector('#loginForm button[type="submit"]');
  if (loginBtn) {
    loginBtn.disabled = false;
    loginBtn.classList.remove("btn-disabled");
  }
}

// Callback when login reCAPTCHA expires
function onLoginRecaptchaExpired() {
  const loginBtn = document.querySelector('#loginForm button[type="submit"]');
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.classList.add("btn-disabled");
  }
}

// Callback when signup reCAPTCHA is completed
function onSignupRecaptchaSuccess() {
  const signupBtn = document.querySelector('#signupForm button[type="submit"]');
  if (signupBtn) {
    signupBtn.disabled = false;
    signupBtn.classList.remove("btn-disabled");
  }
}

// Callback when signup reCAPTCHA expires
function onSignupRecaptchaExpired() {
  const signupBtn = document.querySelector('#signupForm button[type="submit"]');
  if (signupBtn) {
    signupBtn.disabled = true;
    signupBtn.classList.add("btn-disabled");
  }
}

// reCAPTCHA initialization callback - called when reCAPTCHA script loads
function onRecaptchaLoad() {
  const loginRecaptcha = document.getElementById("loginRecaptcha");
  const signupRecaptcha = document.getElementById("signupRecaptcha");

  if (loginRecaptcha) {
    try {
      window.loginRecaptchaWidgetId = grecaptcha.render("loginRecaptcha", {
        sitekey: "6LfhBmMsAAAAAMLoUlm0VlYhc4RLJyscH_YVfs6l",
        callback: onLoginRecaptchaSuccess,
        "expired-callback": onLoginRecaptchaExpired,
      });
    } catch (e) {
      console.log("Login reCAPTCHA already rendered or error:", e);
    }
  }

  if (signupRecaptcha) {
    try {
      window.signupRecaptchaWidgetId = grecaptcha.render("signupRecaptcha", {
        sitekey: "6LfhBmMsAAAAAMLoUlm0VlYhc4RLJyscH_YVfs6l",
        callback: onSignupRecaptchaSuccess,
        "expired-callback": onSignupRecaptchaExpired,
      });
    } catch (e) {
      console.log("Signup reCAPTCHA already rendered or error:", e);
    }
  }
}

// Make functions globally available
window.onRecaptchaLoad = onRecaptchaLoad;
window.onLoginRecaptchaSuccess = onLoginRecaptchaSuccess;
window.onLoginRecaptchaExpired = onLoginRecaptchaExpired;
window.onSignupRecaptchaSuccess = onSignupRecaptchaSuccess;
window.onSignupRecaptchaExpired = onSignupRecaptchaExpired;
