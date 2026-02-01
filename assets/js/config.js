// =========================
// FILE: assets/js/config.js
// =========================
window.APP_CONFIG = {
  // Supabase Credentials
  SUPABASE_URL: "https://oriojylsilcsvcsefuux.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaW9qeWxzaWxjc3Zjc2VmdXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY2MzUsImV4cCI6MjA4MzcwMjYzNX0.iLhf2GI8O060w-uBcNmqDMCiIQrg3sOj2N_Rf_EDKiY",

  // WhatsApp number for checkout (international format, no +)
  WHATSAPP_NUMBER: "2349033344860",

  // Paystack Public Key (Replace with your live key in production)
  PAYSTACK_PUBLIC_KEY: "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",

  // Brand Name
  BRAND_NAME: "Lingerie by Sisioyin",

  // Optional: Delivery fees by area (NGN). You can edit anytime.
  DELIVERY_FEES: {
    Akure: 0,
    Ondo: 0,
    Lagos: 0,
  },

  // Storage Bucket Name (if you later switch admin to upload files)
  STORAGE_BUCKET: "product-images",

  // Google Analytics ID (optional)
  GA_MEASUREMENT_ID: "",

  // Facebook Pixel ID (optional)
  FB_PIXEL_ID: "",
};
