// =========================
// FILE: assets/js/config.js
// =========================
window.APP_CONFIG = {
  // Supabase Credentials
  SUPABASE_URL: "https://oriojylsilcsvcsefuux.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaW9qeWxzaWxjc3Zjc2VmdXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY2MzUsImV4cCI6MjA4MzcwMjYzNX0.iLhf2GI8O060w-uBcNmqDMCiIQrg3sOj2N_Rf_EDKiY",

  // Monnify Payment Gateway Configuration
  // Get your keys from: https://app.monnify.com/
  MONNIFY: {
    apiKey: "MK_TEST_XXXXXXXXXX", // Replace with your Monnify API Key
    contractCode: "XXXXXXXXXX", // Replace with your Monnify Contract Code
    isTestMode: true, // Set to false for production
  },

  // Brand Name
  BRAND_NAME: "Lingerie by Sisioyin",

  // Website Domain (used for SEO, canonical URLs, etc.)
  SITE_URL: "https://lingeriebysisioyin.store",

  // Social Media Links
  SOCIAL: {
    instagram: "https://instagram.com/lingeriebysissioyin",
    tiktok: "https://tiktok.com/@lingeriebysissioyin",
    whatsapp: "https://wa.me/2349033344860",
  },

  // Delivery fees by area (NGN). Edit these to update cart + checkout automatically.
  DELIVERY_FEES: {
    Lagos: 2000,
    Ogun: 2000,
    Oyo: 2500,
    Osun: 2500,
    Ondo: 2500,
    Ekiti: 3000,
    Abuja: 3500,
  },
  DELIVERY_FEE_DEFAULT: 2500, // fallback for unlisted states

  // Storage Bucket Name (if you later switch admin to upload files)
  STORAGE_BUCKET: "product-images",

  // Google Analytics ID
  GA_MEASUREMENT_ID: "G-1KQXSQ2TY8",

  // Facebook Pixel ID
  FB_PIXEL_ID: "3483388498501534",
};
