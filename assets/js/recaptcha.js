/**
 * reCAPTCHA Initialization
 * Moved from inline scripts for better code organization
 */

// reCAPTCHA initialization callback - called when reCAPTCHA script loads
function onRecaptchaLoad() {
  const loginRecaptcha = document.getElementById("loginRecaptcha");
  const signupRecaptcha = document.getElementById("signupRecaptcha");

  if (loginRecaptcha) {
    try {
      window.loginRecaptchaWidgetId = grecaptcha.render("loginRecaptcha", {
        sitekey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
      });
    } catch (e) {
      console.log("Login reCAPTCHA already rendered or error:", e);
    }
  }

  if (signupRecaptcha) {
    try {
      window.signupRecaptchaWidgetId = grecaptcha.render("signupRecaptcha", {
        sitekey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
      });
    } catch (e) {
      console.log("Signup reCAPTCHA already rendered or error:", e);
    }
  }
}

// Make function globally available
window.onRecaptchaLoad = onRecaptchaLoad;
