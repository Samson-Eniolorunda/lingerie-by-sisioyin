/**
 * Checkout Page JavaScript
 * Handles accordion sections, payment methods, and Moniepoint integration
 */
(function () {
  "use strict";

  const CART_KEY = "LBS_CART_V1";

  /* ── Load Google Maps Places API if key is configured ── */
  (function loadGoogleMaps() {
    const key = window.APP_CONFIG?.GOOGLE_MAPS_API_KEY;
    if (!key || document.querySelector('script[src*="maps.googleapis.com"]'))
      return;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  })();

  // State management
  let completedSections = [];
  let currentSection = "contact";

  // Get cart from localStorage
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      return [];
    }
  }

  // Format currency
  function formatNaira(amount) {
    return "₦" + Number(amount || 0).toLocaleString("en-NG");
  }

  // Calculate delivery fee based on state — reads from config.js
  function getDeliveryFee(state) {
    const fees = window.APP_CONFIG?.DELIVERY_FEES || {};
    const fallback = window.APP_CONFIG?.DELIVERY_FEE_DEFAULT || 2500;
    return fees[state] || fallback;
  }

  // Update progress steps — uses new ck-step markup
  function updateProgressSteps() {
    const steps = document.querySelectorAll(".ck-step");
    const lines = document.querySelectorAll(".ck-step-line");
    if (!steps.length) return;

    const sectionOrder = ["contact", "delivery", "payment"];
    const currentIndex = sectionOrder.indexOf(currentSection);

    // Step 0 = Cart (always done), steps 1-2 = contact/delivery
    // Step 3 = Payment — only marks green after actual payment (not method selection)
    // Step 4 = Done — only marks on confirmation page
    steps.forEach((step, i) => {
      step.classList.remove("active", "done");
      if (i === 0) {
        // Cart step — always completed
        step.classList.add("done");
      } else if (i <= 2) {
        // Contact (1) and Delivery (2)
        const sectionIdx = i - 1;
        if (completedSections.includes(sectionOrder[sectionIdx])) {
          step.classList.add("done");
          const num = step.querySelector(".ck-step-num");
          if (num) num.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else if (sectionIdx === currentIndex) {
          step.classList.add("active");
          const num = step.querySelector(".ck-step-num");
          if (num) num.textContent = i + 1;
        } else {
          const num = step.querySelector(".ck-step-num");
          if (num) num.textContent = i + 1;
        }
      } else if (i === 3) {
        // Payment step — mark active once delivery is done, but NEVER done on checkout
        // Only marks green via confirmation page
        if (completedSections.includes("delivery")) {
          step.classList.add("active");
          const num = step.querySelector(".ck-step-num");
          if (num) num.textContent = i + 1;
        } else {
          const num = step.querySelector(".ck-step-num");
          if (num) num.textContent = i + 1;
        }
      } else if (i === 4) {
        // Done step — stays neutral on checkout page
        const num = step.querySelector(".ck-step-num");
        if (num) num.textContent = i + 1;
      }
    });

    lines.forEach((line, i) => {
      // Lines 0-1 follow contact/delivery completion, line 2+ stays neutral
      if (i < 2) {
        line.classList.toggle(
          "done",
          completedSections.includes(sectionOrder[i]),
        );
      } else {
        line.classList.remove("done");
      }
    });
  }

  // Toggle section accordion — new ck-accordion markup
  function toggleSection(sectionName) {
    const card = document.querySelector(`[data-section="${sectionName}"]`);
    const allCards = document.querySelectorAll(".ck-accordion");

    if (
      completedSections.includes(sectionName) ||
      sectionName === currentSection
    ) {
      allCards.forEach((c) => c.classList.remove("active"));
      if (card) card.classList.add("active");
      currentSection = sectionName;
      updateProgressSteps();
    }
  }

  // Complete section and move to next
  function completeSection(sectionName) {
    const sectionOrder = ["contact", "delivery", "payment"];
    const currentIndex = sectionOrder.indexOf(sectionName);

    if (sectionName !== "payment" && !validateSection(sectionName)) return;
    // For payment, validate a method is selected
    if (sectionName === "payment") {
      const selected = document.querySelector(
        'input[name="paymentMethod"]:checked',
      );
      if (!selected) {
        showToast("Please select a payment method", "error");
        return;
      }
    }

    if (!completedSections.includes(sectionName)) {
      completedSections.push(sectionName);
    }

    const currentCard = document.querySelector(
      `[data-section="${sectionName}"]`,
    );
    if (currentCard) {
      currentCard.classList.add("completed");
      currentCard.classList.remove("active");
    }

    // Open next section only if not payment (payment is last, just close)
    if (currentIndex < sectionOrder.length - 1) {
      const nextSection = sectionOrder[currentIndex + 1];
      const nextCard = document.querySelector(
        `[data-section="${nextSection}"]`,
      );
      if (nextCard) nextCard.classList.add("active");
      currentSection = nextSection;
    }

    updateProgressSteps();
    updateTotals();
  }

  // Validate section fields
  function validateSection(sectionName) {
    let isValid = true;
    let fields = [];

    if (sectionName === "contact") {
      fields = ["firstName", "lastName", "email", "phone"];
    } else if (sectionName === "delivery") {
      fields = ["address", "city", "state"];
    }

    fields.forEach((fieldId) => {
      const input = document.getElementById(fieldId);
      if (input && !input.value.trim()) {
        input.style.borderColor = "var(--clr-error)";
        isValid = false;
      } else if (input) {
        input.style.borderColor = "";
      }
    });

    if (!isValid) {
      showToast("Please fill in all required fields", "error");
    }

    return isValid;
  }

  // Render cart items in summary
  function renderSummaryItems() {
    const cart = getCart();
    const container = document.getElementById("summaryItems");
    const emptyEl = document.getElementById("checkoutEmpty");
    const wrapperEl = document.getElementById("checkoutWrapper");

    if (!cart.length) {
      if (emptyEl) emptyEl.style.display = "block";
      if (wrapperEl) wrapperEl.style.display = "none";
      // Hide checkout progress when cart is empty
      const progressSection = document.querySelector(
        ".checkout-progress-section",
      );
      if (progressSection) progressSection.classList.add("is-hidden");
      return;
    }

    // Show progress when cart has items
    const progressSection = document.querySelector(
      ".checkout-progress-section",
    );
    if (progressSection) progressSection.classList.remove("is-hidden");

    if (emptyEl) emptyEl.style.display = "none";
    if (wrapperEl) wrapperEl.style.display = "grid";

    container.innerHTML = cart
      .map(
        (item) => `
          <div class="summary-item">
            <div class="summary-item-img">
              <img src="${item.image}" alt="${item.name}" loading="lazy">
            </div>
            <div class="summary-item-info">
              <span class="summary-item-name">${item.name}</span>
              <span class="summary-item-meta">
                ${item.selectedSize || "One Size"}${item.selectedColor ? " • " + item.selectedColor : ""} × ${item.qty}
              </span>
            </div>
            <div class="summary-item-right">
              <span class="summary-item-price">${formatNaira(item.price_ngn * item.qty)}</span>
              <a href="/shop?product=${item.id || ""}" class="summary-item-edit" title="Edit item"><i class="fa-solid fa-pen-to-square"></i></a>
            </div>
          </div>
        `,
      )
      .join("");
  }

  // Calculate and update totals
  function updateTotals() {
    const cart = getCart();
    const stateSelect = document.getElementById("state");
    const state = stateSelect?.value || "Lagos";

    const subtotal = cart.reduce(
      (sum, item) => sum + item.price_ngn * item.qty,
      0,
    );
    const deliveryFee = getDeliveryFee(state);
    const total = subtotal + deliveryFee;

    const subtotalEl = document.getElementById("checkoutSubtotal");
    const deliveryEl = document.getElementById("checkoutDelivery");
    const totalEl = document.getElementById("checkoutTotal");

    if (subtotalEl) subtotalEl.textContent = formatNaira(subtotal);
    if (deliveryEl) deliveryEl.textContent = formatNaira(deliveryFee);
    if (totalEl) totalEl.textContent = formatNaira(total);
  }

  // Handle payment method selection — auto-complete payment section
  function setupPaymentMethods() {
    const options = document.querySelectorAll(".payment-option");

    options.forEach((option) => {
      option.addEventListener("click", function () {
        options.forEach((o) => o.classList.remove("selected"));
        this.classList.add("selected");

        const radio = this.querySelector('input[type="radio"]');
        radio.checked = true;

        // Auto-complete payment section after small delay (visual feedback)
        setTimeout(() => completeSection("payment"), 300);
      });
    });
  }

  // Show toast notification
  function showToast(message, type = "info") {
    if (window.UTILS?.toast) {
      UTILS.toast(message, type);
    } else {
      const toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove("show"), 3000);
      }
    }
  }

  // Validate entire form
  function validateForm() {
    const required = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "address",
      "city",
      "state",
    ];
    let isValid = true;

    required.forEach((field) => {
      const input = document.getElementById(field);
      if (!input?.value.trim()) {
        input.style.borderColor = "var(--clr-error)";
        isValid = false;
      } else {
        input.style.borderColor = "";
      }
    });

    return isValid;
  }

  // Build order data
  function buildOrderData() {
    const cart = getCart();
    const state = document.getElementById("state").value;
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price_ngn * item.qty,
      0,
    );
    const deliveryFee = getDeliveryFee(state);

    return {
      customer: {
        firstName: document.getElementById("firstName").value,
        lastName: document.getElementById("lastName").value,
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,
      },
      delivery: {
        address: document.getElementById("address").value,
        city: document.getElementById("city").value,
        state: state,
        landmark: document.getElementById("landmark").value,
        notes: document.getElementById("orderNotes").value,
      },
      items: cart,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: subtotal + deliveryFee,
      paymentMethod: document.querySelector(
        'input[name="paymentMethod"]:checked',
      )?.value,
      reference: "LBS_" + Date.now(),
    };
  }

  // Save completed order to Supabase (fires the email trigger)
  async function saveOrderToDatabase(orderData) {
    const c = window.DB?.client;
    if (!c) {
      console.warn(
        "CHECKOUT: Supabase client not available, order not saved to DB",
      );
      return null;
    }

    try {
      const { data, error } = await c
        .from("orders")
        .insert({
          customer_name:
            `${orderData.customer.firstName} ${orderData.customer.lastName}`.trim(),
          customer_email: orderData.customer.email || null,
          customer_phone: orderData.customer.phone,
          delivery_address: orderData.delivery.address,
          delivery_city: orderData.delivery.city,
          delivery_state: orderData.delivery.state,
          items: orderData.items,
          subtotal: orderData.subtotal,
          shipping_cost: orderData.deliveryFee,
          discount_amount: orderData.discountAmount || 0,
          promo_code: orderData.promoCode || null,
          total: orderData.total,
          status: orderData.paymentStatus === "PAID" ? "processing" : "pending",
          payment_method: orderData.paymentMethod || "card",
          payment_status: orderData.paymentStatus || "paid",
          notes: orderData.delivery.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      console.log("CHECKOUT: Order saved to DB:", data?.order_number);
      return data;
    } catch (e) {
      console.error("CHECKOUT: Failed to save order to DB:", e);
      return null;
    }
  }

  // Handle place order
  function handlePlaceOrder() {
    if (!validateForm()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    const orderData = buildOrderData();
    const paymentMethod = orderData.paymentMethod;

    // Both card and bank transfer use Moniepoint
    showToast("Initializing Moniepoint payment...", "info");
    initMoniepointPayment(orderData, paymentMethod);
  }

  // Initialize Monnify Payment (Moniepoint's payment gateway)
  function initMoniepointPayment(orderData, paymentMethod) {
    const btn = document.getElementById("placeOrderBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    // Check if Monnify SDK is loaded
    if (typeof MonnifySDK === "undefined") {
      showToast("Payment system loading. Please wait...", "warning");
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa-solid fa-lock"></i> <span>Place Order</span>';
      return;
    }

    // Get Monnify config from APP_CONFIG or use test keys
    const monnifyConfig = window.APP_CONFIG?.MONNIFY || {
      apiKey: "MK_TEST_XXXXXXXXXX", // fallback — should come from APP_CONFIG
      contractCode: "XXXXXXXXXX",
      isTestMode: false,
    };

    // Determine payment methods based on selection
    const paymentMethods =
      paymentMethod === "card"
        ? ["CARD", "ACCOUNT_TRANSFER"]
        : ["ACCOUNT_TRANSFER", "CARD"];

    // Reset button helper
    const resetBtn = () => {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa-solid fa-lock"></i> <span>Place Order</span>';
    };

    // Safety timeout — if Monnify popup never appears, reset after 15s
    const safetyTimer = setTimeout(() => {
      // Only reset if button is still in processing state
      if (btn.disabled) {
        resetBtn();
        showToast("Payment gateway didn't respond. Please try again.", "error");
      }
    }, 15000);

    // Pre-validate data before sending to Monnify (SDK fails silently)
    const email = orderData.customer.email;
    const amount = orderData.total;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      clearTimeout(safetyTimer);
      resetBtn();
      showToast("Please enter a valid email address.", "error");
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      clearTimeout(safetyTimer);
      resetBtn();
      showToast("Invalid order amount. Please refresh and try again.", "error");
      return;
    }
    if (!monnifyConfig.apiKey || !monnifyConfig.contractCode) {
      clearTimeout(safetyTimer);
      resetBtn();
      showToast("Payment gateway is not configured.", "error");
      return;
    }

    console.log("CHECKOUT: Monnify init →", {
      amount,
      email,
      apiKey: monnifyConfig.apiKey,
      contractCode: monnifyConfig.contractCode,
      isTestMode: monnifyConfig.isTestMode,
      reference: orderData.reference,
    });

    // Define callbacks as named functions (Monnify SDK rejects inline defs)
    function handleComplete(response) {
      clearTimeout(safetyTimer);
      console.log("Monnify payment complete:", response);

      if (response.status === "SUCCESS" || response.paymentStatus === "PAID") {
        var confirmedOrder = {
          ...orderData,
          paymentReference:
            response.transactionReference || response.paymentReference,
          paymentStatus: "PAID",
          paidAt: new Date().toISOString(),
        };

        saveOrderToDatabase(confirmedOrder).then(function (dbOrder) {
          if (dbOrder && dbOrder.order_number) {
            confirmedOrder.reference = dbOrder.order_number;
            sessionStorage.setItem(
              "LBS_CONFIRMED_ORDER",
              JSON.stringify(confirmedOrder),
            );
          }
        });

        sessionStorage.setItem(
          "LBS_CONFIRMED_ORDER",
          JSON.stringify(confirmedOrder),
        );

        localStorage.removeItem(CART_KEY);
        // Clear form persistence for checkout page
        try {
          sessionStorage.removeItem("LBS_FORM__checkout");
        } catch {}

        if (window.APP && window.APP.updateCartBadge) {
          window.APP.updateCartBadge();
        }

        showToast("Payment successful! Redirecting...", "success");

        setTimeout(function () {
          window.location.href = "/confirmation";
        }, 1500);
      } else {
        resetBtn();
        showToast("Payment was not completed. Please try again.", "error");
      }
    }

    function handleClose(data) {
      clearTimeout(safetyTimer);
      console.log("Monnify closed:", data);
      resetBtn();
      showToast("Payment cancelled", "info");
    }

    try {
      MonnifySDK.initialize({
        amount: amount,
        currency: "NGN",
        reference: "LBS_" + Date.now(),
        customerName:
          orderData.customer.firstName + " " + orderData.customer.lastName,
        customerEmail: email,
        customerMobileNumber: orderData.customer.phone,
        apiKey: monnifyConfig.apiKey,
        contractCode: monnifyConfig.contractCode,
        paymentDescription: "LBS Order",
        isTestMode: monnifyConfig.isTestMode,
        onComplete: handleComplete,
        onClose: handleClose,
      });
    } catch (err) {
      clearTimeout(safetyTimer);
      console.error("Monnify SDK error:", err);
      resetBtn();
      showToast("Payment failed to initialize. Please try again.", "error");
    }
  }

  // Handle state select for floating label
  function setupStateSelect() {
    const stateSelect = document.getElementById("state");
    if (stateSelect) {
      stateSelect.addEventListener("change", function () {
        if (this.value) {
          this.classList.add("has-value");
        } else {
          this.classList.remove("has-value");
        }
        updateTotals();
      });
    }
  }

  // Initialize checkout page
  /* ── Google Places Autocomplete for address ── */
  function initPlacesAutocomplete() {
    const addressInput = document.getElementById("address");
    if (!addressInput) return;

    // Map of Google's administrative_area_level_1 names → our <select> option values
    const STATE_MAP = {
      lagos: "Lagos",
      ogun: "Ogun",
      oyo: "Oyo",
      osun: "Osun",
      ondo: "Ondo",
      ekiti: "Ekiti",
      "federal capital territory": "Abuja",
      abuja: "Abuja",
    };

    function attach() {
      if (!window.google?.maps?.places) return false;
      const autocomplete = new google.maps.places.Autocomplete(addressInput, {
        componentRestrictions: { country: "ng" },
        fields: ["address_components"],
        types: ["address"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        let streetNumber = "",
          route = "",
          neighborhood = "",
          sublocality = "",
          city = "",
          state = "";
        place.address_components.forEach((c) => {
          const t = c.types;
          if (t.includes("street_number")) streetNumber = c.long_name;
          if (t.includes("route")) route = c.long_name;
          if (t.includes("neighborhood")) neighborhood = c.long_name;
          if (t.includes("sublocality_level_1") || t.includes("sublocality"))
            sublocality = c.long_name;
          if (t.includes("locality")) city = c.long_name;
          if (t.includes("administrative_area_level_2") && !city)
            city = c.long_name;
          if (t.includes("administrative_area_level_1")) state = c.long_name;
        });

        // Build street: number + route, fallback to neighborhood/sublocality
        let street = "";
        if (route) {
          street = streetNumber ? `${streetNumber} ${route}` : route;
        }
        if (neighborhood && !street.includes(neighborhood)) {
          street = street ? `${street}, ${neighborhood}` : neighborhood;
        }
        if (sublocality && !street.includes(sublocality)) {
          street = street ? `${street}, ${sublocality}` : sublocality;
        }

        if (street) {
          addressInput.value = street;
          addressInput.dispatchEvent(new Event("input"));
        }

        const cityInput = document.getElementById("city");
        if (cityInput && city) {
          cityInput.value = city;
          cityInput.dispatchEvent(new Event("input"));
        }

        const stateSelect = document.getElementById("state");
        if (stateSelect && state) {
          const mapped = STATE_MAP[state.toLowerCase()] || "";
          if (mapped) {
            stateSelect.value = mapped;
            stateSelect.classList.add("has-value");
            stateSelect.dispatchEvent(new Event("change"));
          }
        }

        // Close the Google dropdown
        addressInput.blur();
      });
      return true;
    }

    // Try immediately, otherwise poll until the async script loads
    if (!attach()) {
      let attempts = 0;
      const poll = setInterval(() => {
        if (attach() || ++attempts > 40) clearInterval(poll); // ~8 s max
      }, 200);
    }
  }

  /* ── Saved address picker ── */
  function loadSavedAddresses() {
    const picker = document.getElementById("savedAddrPicker");
    const list = document.getElementById("savedAddrList");
    if (!picker || !list) return;

    let addrs = [];
    try {
      addrs = JSON.parse(localStorage.getItem("LBS_ADDRESSES") || "[]");
    } catch {
      /* ignore */
    }
    if (!addrs.length) {
      picker.style.display = "none";
      return;
    }

    picker.style.display = "";
    list.innerHTML = addrs
      .map(
        (a, i) => `
      <button type="button" class="saved-addr-chip" data-idx="${i}">
        <span class="saved-addr-chip-icon"><i class="fa-solid fa-location-dot"></i></span>
        <span class="saved-addr-chip-text">
          <strong>${a.label || "Address " + (i + 1)}</strong>
          <small>${a.street}, ${a.city}${a.state ? ", " + a.state : ""}</small>
        </span>
      </button>`,
      )
      .join("");

    list.querySelectorAll(".saved-addr-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = addrs[+btn.dataset.idx];
        if (!a) return;
        const addrEl = document.getElementById("address");
        const cityEl = document.getElementById("city");
        const stateEl = document.getElementById("state");
        if (addrEl) addrEl.value = a.street;
        if (cityEl) cityEl.value = a.city;
        if (stateEl) {
          // Try to match select option
          const opt = [...stateEl.options].find((o) =>
            o.value.toLowerCase().includes((a.state || "").toLowerCase()),
          );
          stateEl.value = opt ? opt.value : a.state || "";
        }
        // Highlight selected chip
        list
          .querySelectorAll(".saved-addr-chip")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        // Trigger floating label
        [addrEl, cityEl, stateEl].forEach((el) => {
          if (el) el.dispatchEvent(new Event("input"));
        });
      });
    });
  }

  /* ── Show "use profile info" banner if user is logged in ── */
  let _cachedUserFields = null;

  async function prefillUserInfo() {
    try {
      const user = await window.AUTH?.getUser?.();
      if (!user) return;

      const meta = user.user_metadata || {};
      _cachedUserFields = {
        firstName: meta.first_name || meta.full_name?.split(" ")[0] || "",
        lastName:
          meta.last_name || meta.full_name?.split(" ").slice(1).join(" ") || "",
        email: user.email || "",
        phone: meta.phone || user.phone || "",
      };

      // Only show banner if there's meaningful data to fill
      const hasData = Object.values(_cachedUserFields).some((v) => v.trim());
      const banner = document.getElementById("profileInfoBanner");
      if (banner && hasData) {
        banner.classList.remove("u-hidden");
      }

      // "Yes, use it" button
      const yesBtn = document.getElementById("useProfileInfoBtn");
      yesBtn?.addEventListener("click", () => {
        Object.entries(_cachedUserFields).forEach(([id, val]) => {
          const el = document.getElementById(id);
          if (el && val) {
            el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });
        if (banner) banner.classList.add("u-hidden");
      });

      // "No, enter manually" button — just hides the banner
      const noBtn = document.getElementById("enterManualInfoBtn");
      noBtn?.addEventListener("click", () => {
        if (banner) banner.classList.add("u-hidden");
      });
    } catch (e) {
      console.warn("Checkout: Could not check user info", e);
    }
  }

  function init() {
    // Check if we're on checkout page
    if (!document.getElementById("checkoutWrapper")) return;

    renderSummaryItems();
    updateTotals();
    setupPaymentMethods();
    setupStateSelect();
    updateProgressSteps();
    loadSavedAddresses();
    initPlacesAutocomplete();
    prefillUserInfo();

    // Event listeners
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    if (placeOrderBtn) {
      placeOrderBtn.addEventListener("click", handlePlaceOrder);
    }

    // Set current year
    const yearEl = document.getElementById("currentYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Expose functions globally for onclick handlers
    window.toggleSection = toggleSection;
    window.completeSection = completeSection;

    // Bind data-attribute section toggles (replaces inline onclick handlers)
    document.querySelectorAll("[data-toggle-section]").forEach((el) => {
      el.addEventListener("click", () =>
        toggleSection(el.dataset.toggleSection),
      );
    });
    document.querySelectorAll("[data-complete-section]").forEach((el) => {
      el.addEventListener("click", () =>
        completeSection(el.dataset.completeSection),
      );
    });

    // Edit buttons — reopen completed section
    document.querySelectorAll("[data-edit-section]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Don't trigger accordion toggle
        const section = btn.dataset.editSection;
        toggleSection(section);
      });
    });
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
