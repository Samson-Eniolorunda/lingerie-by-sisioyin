/**
 * reCAPTCHA Initialization
 * Moved from inline scripts for better code organization
 * reCAPTCHA is now rendered on-demand (on first form submit), not on page load.
 * These callbacks are still needed for when reCAPTCHA is rendered by auth.js.
 */

// Callback when login reCAPTCHA is completed — hide widget smoothly
function onLoginRecaptchaSuccess() {
  const field = document.querySelector("#loginForm .recaptcha-field");
  if (field) field.classList.add("verified");
}

// Callback when login reCAPTCHA expires — show widget again
function onLoginRecaptchaExpired() {
  const field = document.querySelector("#loginForm .recaptcha-field");
  if (field) field.classList.remove("verified");
}

// Callback when signup reCAPTCHA is completed — hide widget smoothly
function onSignupRecaptchaSuccess() {
  const field = document.querySelector("#signupForm .recaptcha-field");
  if (field) field.classList.add("verified");
}

// Callback when signup reCAPTCHA expires — show widget again
function onSignupRecaptchaExpired() {
  const field = document.querySelector("#signupForm .recaptcha-field");
  if (field) field.classList.remove("verified");
}

// reCAPTCHA initialization callback - called when reCAPTCHA script loads
// No longer renders immediately — auth.js renders on first submit attempt
function onRecaptchaLoad() {
  console.log("reCAPTCHA API loaded and ready");
}

// Make functions globally available
window.onRecaptchaLoad = onRecaptchaLoad;
window.onLoginRecaptchaSuccess = onLoginRecaptchaSuccess;
window.onLoginRecaptchaExpired = onLoginRecaptchaExpired;
window.onSignupRecaptchaSuccess = onSignupRecaptchaSuccess;
window.onSignupRecaptchaExpired = onSignupRecaptchaExpired;
