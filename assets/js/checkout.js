/**
 * Checkout Page JavaScript
 * Handles accordion sections, payment methods, and Moniepoint integration
 */
(function () {
  "use strict";

  const CART_KEY = "LBS_CART_V1";

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

  // Update progress steps
  function updateProgressSteps() {
    const steps = document.querySelectorAll(".checkout-progress-step");
    const connectors = document.querySelectorAll(
      ".checkout-progress-connector",
    );

    const sectionOrder = ["contact", "delivery", "payment"];
    const currentIndex = sectionOrder.indexOf(currentSection);

    steps.forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove("completed", "active");

      if (
        index < currentIndex ||
        completedSections.includes(sectionOrder[index])
      ) {
        step.classList.add("completed");
        step.querySelector(".step-circle").innerHTML =
          '<i class="fa-solid fa-check"></i>';
      } else if (index === currentIndex) {
        step.classList.add("active");
        step.querySelector(".step-circle").textContent = stepNum;
      } else {
        step.querySelector(".step-circle").textContent = stepNum;
      }
    });

    connectors.forEach((connector, index) => {
      connector.classList.toggle("completed", index < currentIndex);
    });
  }

  // Toggle section accordion
  function toggleSection(sectionName) {
    const card = document.querySelector(`[data-section="${sectionName}"]`);
    const allCards = document.querySelectorAll(".checkout-card");

    // If section is completed, allow editing
    if (
      completedSections.includes(sectionName) ||
      sectionName === currentSection
    ) {
      allCards.forEach((c) => c.classList.remove("active", "expanded"));
      card.classList.add("active", "expanded");
      currentSection = sectionName;
      updateProgressSteps();
    }
  }

  // Complete section and move to next
  function completeSection(sectionName) {
    const sectionOrder = ["contact", "delivery", "payment"];
    const currentIndex = sectionOrder.indexOf(sectionName);

    // Validate section
    if (!validateSection(sectionName)) {
      return;
    }

    // Mark as completed
    if (!completedSections.includes(sectionName)) {
      completedSections.push(sectionName);
    }

    // Update card styling
    const currentCard = document.querySelector(
      `[data-section="${sectionName}"]`,
    );
    currentCard.classList.add("completed");
    currentCard.classList.remove("active");

    // Open next section
    if (currentIndex < sectionOrder.length - 1) {
      const nextSection = sectionOrder[currentIndex + 1];
      const nextCard = document.querySelector(
        `[data-section="${nextSection}"]`,
      );
      nextCard.classList.add("active", "expanded");
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
            <span class="summary-item-price">${formatNaira(item.price_ngn * item.qty)}</span>
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

  // Handle payment method selection
  function setupPaymentMethods() {
    const options = document.querySelectorAll(".payment-option");

    options.forEach((option) => {
      option.addEventListener("click", function () {
        options.forEach((o) => o.classList.remove("selected"));
        this.classList.add("selected");

        const radio = this.querySelector('input[type="radio"]');
        radio.checked = true;
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

    MonnifySDK.initialize({
      amount: orderData.total,
      currency: "NGN",
      reference: orderData.reference,
      customerFullName: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
      customerEmail: orderData.customer.email,
      customerMobileNumber: orderData.customer.phone,
      apiKey: monnifyConfig.apiKey,
      contractCode: monnifyConfig.contractCode,
      paymentDescription: `LBS Order - ${orderData.reference}`,
      isTestMode: monnifyConfig.isTestMode,
      paymentMethods: paymentMethods,
      metadata: {
        orderId: orderData.reference,
        items: orderData.items.length,
        deliveryState: orderData.delivery.state,
      },
      onComplete: async function (response) {
        console.log("Monnify payment complete:", response);

        if (
          response.status === "SUCCESS" ||
          response.paymentStatus === "PAID"
        ) {
          // Payment successful
          const confirmedOrder = {
            ...orderData,
            paymentReference:
              response.transactionReference || response.paymentReference,
            paymentStatus: "PAID",
            paidAt: new Date().toISOString(),
          };

          // Save order to Supabase (triggers confirmation email)
          const dbOrder = await saveOrderToDatabase(confirmedOrder);
          if (dbOrder?.order_number) {
            confirmedOrder.reference = dbOrder.order_number;
          }

          // Store confirmed order for confirmation page
          sessionStorage.setItem(
            "LBS_CONFIRMED_ORDER",
            JSON.stringify(confirmedOrder),
          );

          // Clear cart
          localStorage.removeItem(CART_KEY);

          // Update cart badge
          if (window.APP?.updateCartBadge) {
            window.APP.updateCartBadge();
          }

          showToast("Payment successful! Redirecting...", "success");

          // Redirect to confirmation page
          setTimeout(() => {
            window.location.href = "/confirmation";
          }, 1500);
        } else {
          // Payment failed or pending
          btn.disabled = false;
          btn.innerHTML =
            '<i class="fa-solid fa-lock"></i> <span>Place Order</span>';
          showToast("Payment was not completed. Please try again.", "error");
        }
      },
      onClose: function (data) {
        console.log("Monnify closed:", data);
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fa-solid fa-lock"></i> <span>Place Order</span>';
        showToast("Payment cancelled", "info");
      },
    });
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

  function init() {
    // Check if we're on checkout page
    if (!document.getElementById("checkoutWrapper")) return;

    renderSummaryItems();
    updateTotals();
    setupPaymentMethods();
    setupStateSelect();
    updateProgressSteps();
    loadSavedAddresses();

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
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
