/**
 * Lingerie by Sisioyin - Utility Functions
 * Modern utility library for e-commerce functionality
 */

(function (global) {
  "use strict";
  console.log("🔧 UTILS: Module initializing");

  const UTILS = {};

  /* ─────────────────────────────────────────────
   * Currency & Price Formatting
   * ───────────────────────────────────────────── */

  /**
   * Format a number as Naira currency
   * @param {number} amount - The amount to format
   * @returns {string} Formatted currency string
   */
  UTILS.formatNaira = function (amount) {
    const num = parseFloat(amount) || 0;
    return (
      "₦" +
      num.toLocaleString("en-NG", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    );
  };

  /**
   * Alias for formatNaira
   */
  UTILS.formatPrice = UTILS.formatNaira;

  /**
   * Parse a price string to number
   * @param {string} priceString - Price string like "₦5,000"
   * @returns {number} Numeric value
   */
  UTILS.parsePrice = function (priceString) {
    if (typeof priceString === "number") return priceString;
    return parseFloat(String(priceString).replace(/[₦,\s]/g, "")) || 0;
  };

  /* ─────────────────────────────────────────────
   * Text & String Utilities
   * ───────────────────────────────────────────── */

  /**
   * Sanitize text to prevent XSS
   * @param {string} text - Raw text
   * @returns {string} Sanitized text
   */
  UTILS.safeText = function (text) {
    if (text == null) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  };

  /**
   * Truncate text with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  UTILS.truncate = function (text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text || "";
    return text.slice(0, maxLength).trim() + "...";
  };

  /**
   * Capitalize first letter
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  UTILS.capitalize = function (str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  /**
   * Generate slug from text
   * @param {string} text - Text to slugify
   * @returns {string} Slug
   */
  UTILS.slugify = function (text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  /* ─────────────────────────────────────────────
   * Array & Object Utilities
   * ───────────────────────────────────────────── */

  /**
   * Parse CSV or comma-separated string to array
   * @param {string|Array} input - CSV string or array
   * @returns {Array} Parsed array
   */
  UTILS.parseCSV = function (input) {
    if (Array.isArray(input)) return input;
    if (!input || typeof input !== "string") return [];
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  /**
   * Get unique values from array
   * @param {Array} arr - Input array
   * @returns {Array} Unique values
   */
  UTILS.unique = function (arr) {
    return [...new Set(arr)];
  };

  /**
   * Deep clone an object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  UTILS.deepClone = function (obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return obj;
    }
  };

  /* ─────────────────────────────────────────────
   * LocalStorage Helpers
   * ───────────────────────────────────────────── */

  /**
   * Save JSON to localStorage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   */
  UTILS.saveJSON = function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
  };

  /**
   * Load JSON from localStorage
   * @param {string} key - Storage key
   * @param {*} fallback - Default value if not found
   * @returns {*} Parsed value or fallback
   */
  UTILS.loadJSON = function (key, fallback = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.warn("Failed to load from localStorage:", e);
      return fallback;
    }
  };

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   */
  UTILS.removeJSON = function (key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Failed to remove from localStorage:", e);
    }
  };

  /* ─────────────────────────────────────────────
   * UI Utilities
   * ───────────────────────────────────────────── */

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type (success, error, warning, info)
   * @param {number} duration - Duration in ms
   */
  UTILS.toast = function (message, type = "success", duration = 3000) {
    console.log("🔧 UTILS: toast()", type, message);
    // Try multiple selectors for compatibility
    let toastEl =
      document.querySelector("[data-toast]") ||
      document.querySelector("#toast") ||
      document.querySelector(".toast");

    if (!toastEl) {
      // Create toast element if it doesn't exist
      toastEl = document.createElement("div");
      toastEl.id = "toast";
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }

    toastEl.textContent = message;
    toastEl.className = "toast toast-" + type + " show";
    toastEl.hidden = false;

    clearTimeout(toastEl._timeout);
    toastEl._timeout = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => {
        toastEl.hidden = true;
      }, 300);
    }, duration);
  };

  /**
   * Alias for toast
   */
  UTILS.showToast = UTILS.toast;

  /**
   * Create debounced function
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in ms
   * @returns {Function} Debounced function
   */
  UTILS.debounce = function (fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  /**
   * Create throttled function
   * @param {Function} fn - Function to throttle
   * @param {number} limit - Time limit in ms
   * @returns {Function} Throttled function
   */
  UTILS.throttle = function (fn, limit = 100) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  };

  /**
   * Wait for specified milliseconds
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after delay
   */
  UTILS.sleep = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  /* ─────────────────────────────────────────────
   * DOM Utilities
   * ───────────────────────────────────────────── */

  /**
   * Query selector shorthand
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element
   * @returns {Element|null} Found element
   */
  UTILS.$ = function (selector, context = document) {
    return context.querySelector(selector);
  };

  /**
   * Query selector all shorthand
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element
   * @returns {NodeList} Found elements
   */
  UTILS.$$ = function (selector, context = document) {
    return context.querySelectorAll(selector);
  };

  /**
   * Create element with attributes
   * @param {string} tag - Tag name
   * @param {Object} attrs - Attributes
   * @param {string} html - Inner HTML
   * @returns {Element} Created element
   */
  UTILS.createElement = function (tag, attrs = {}, html = "") {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "className") {
        el.className = value;
      } else if (key === "dataset") {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          el.dataset[dataKey] = dataValue;
        });
      } else {
        el.setAttribute(key, value);
      }
    });
    if (html) el.innerHTML = html;
    return el;
  };

  /* ─────────────────────────────────────────────
   * Image Utilities
   * ───────────────────────────────────────────── */

  /**
   * Get first image from array or string
   * @param {string|Array} images - Image source(s)
   * @param {string} fallback - Fallback image URL
   * @returns {string} Image URL
   */
  UTILS.getFirstImage = function (
    images,
    fallback = "https://placehold.co/400x400/f8fafc/be185d?text=No+Image",
  ) {
    if (Array.isArray(images) && images.length > 0) {
      return images[0];
    }
    if (typeof images === "string" && images.trim()) {
      return images.split(",")[0].trim();
    }
    return fallback;
  };

  /**
   * Parse images to array
   * @param {string|Array} images - Image source(s)
   * @returns {Array} Image URLs array
   */
  UTILS.parseImages = function (images) {
    if (Array.isArray(images)) return images;
    if (typeof images === "string" && images.trim()) {
      return images
        .split(",")
        .map((img) => img.trim())
        .filter(Boolean);
    }
    return [];
  };

  /* ─────────────────────────────────────────────
   * URL Utilities
   * ───────────────────────────────────────────── */

  /**
   * Get URL parameter
   * @param {string} name - Parameter name
   * @returns {string|null} Parameter value
   */
  UTILS.getParam = function (name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  };

  /**
   * Set URL parameter without reload
   * @param {string} name - Parameter name
   * @param {string} value - Parameter value
   */
  UTILS.setParam = function (name, value) {
    const url = new URL(window.location);
    if (value) {
      url.searchParams.set(name, value);
    } else {
      url.searchParams.delete(name);
    }
    history.replaceState({}, "", url);
  };

  /* ─────────────────────────────────────────────
   * Validation Utilities
   * ───────────────────────────────────────────── */

  /**
   * Check if value is empty
   * @param {*} value - Value to check
   * @returns {boolean} Is empty
   */
  UTILS.isEmpty = function (value) {
    if (value == null) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  };

  /**
   * Check if valid phone number
   * @param {string} phone - Phone number
   * @returns {boolean} Is valid
   */
  UTILS.isValidPhone = function (phone) {
    const cleaned = String(phone).replace(/[\s\-\(\)]/g, "");
    return /^(\+?234|0)?[789]\d{9}$/.test(cleaned);
  };

  // Export to global
  global.UTILS = UTILS;
  console.log("✅ UTILS: Module ready");
})(typeof window !== "undefined" ? window : this);
