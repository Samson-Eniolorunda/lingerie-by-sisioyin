/**
 * Checkout Page JavaScript
 * Handles accordion sections, payment methods, and bank transfer flow
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
    const fallback = window.APP_CONFIG?.DELIVERY_FEE_DEFAULT ?? 2500;
    return state in fees ? fees[state] : fallback;
  }

  // Update progress steps — uses new ck-step markup
  function updateProgressSteps() {
    const steps = document.querySelectorAll(".ck-step");
    const lines = document.querySelectorAll(".ck-step-line");
    if (!steps.length) return;

    const sectionOrder = ["contact", "delivery", "payment"];
    const currentIndex = sectionOrder.indexOf(currentSection);
    const receiptConfirmed = document
      .getElementById("paymentSentBtn")
      ?.classList.contains("confirmed");

    // Step 0 = Cart (always done)
    // Step 1 = Shipping — green when delivery address is completed
    // Step 2 = Payment — green only when receipt is confirmed
    // Step 3 = Done — stays neutral on checkout (only green on confirmation page)
    steps.forEach((step, i) => {
      step.classList.remove("active", "done");
      if (i === 0) {
        // Cart step — always completed
        step.classList.add("done");
      } else if (i === 1) {
        // Shipping step — green when delivery is done
        if (completedSections.includes("delivery")) {
          step.classList.add("done");
          const num = step.querySelector(".ck-step-num");
          if (num) num.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else if (completedSections.includes("contact")) {
          step.classList.add("active");
          const num = step.querySelector(".ck-step-num");
          if (num) num.textContent = "2";
        } else {
          const num = step.querySelector(".ck-step-num");
          if (num) num.textContent = "2";
        }
      } else if (i === 2) {
        // Payment step — green only when receipt is confirmed
        if (receiptConfirmed) {
          step.classList.add("done");
          const num = step.querySelector(".ck-step-num");
          if (num) num.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else if (completedSections.includes("delivery")) {
          step.classList.add("active");
          const num = step.querySelector(".ck-step-num");
          if (num) num.textContent = "3";
        } else {
          const num = step.querySelector(".ck-step-num");
          if (num) num.textContent = "3";
        }
      } else if (i === 3) {
        // Done step — stays neutral on checkout page
        const num = step.querySelector(".ck-step-num");
        if (num) num.textContent = "4";
      }
    });

    lines.forEach((line, i) => {
      line.classList.remove("done");
      if (i === 0) {
        // Line after Cart — done when contact is completed
        line.classList.toggle("done", completedSections.includes("contact"));
      } else if (i === 1) {
        // Line after Shipping — done when delivery is completed
        line.classList.toggle("done", completedSections.includes("delivery"));
      } else if (i === 2) {
        // Line after Payment — done when receipt confirmed
        line.classList.toggle("done", !!receiptConfirmed);
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

      // Fix mobile horizontal overflow after section change
      requestAnimationFrame(() => {
        window.scrollTo({ left: 0 });
        document.documentElement.scrollLeft = 0;
        document.body.scrollLeft = 0;
      });

      // Re-show saved data banners if fields are empty
      if (sectionName === "contact") {
        reshowProfileBanner();
      } else if (sectionName === "delivery") {
        reshowSavedAddresses();
      }
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

    // Fix mobile horizontal overflow after section change
    requestAnimationFrame(() => {
      window.scrollTo({ left: 0 });
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    });

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
    const options = document.querySelectorAll(
      ".payment-option:not(.payment-option--disabled)",
    );

    options.forEach((option) => {
      option.addEventListener("click", function () {
        document
          .querySelectorAll(".payment-option")
          .forEach((o) => o.classList.remove("selected"));
        this.classList.add("selected");

        const radio = this.querySelector('input[type="radio"]');
        if (radio && !radio.disabled) radio.checked = true;

        // Show bank transfer details if bank transfer selected
        const bankDetails = document.getElementById("bankTransferDetails");
        if (bankDetails) {
          bankDetails.hidden = radio?.value !== "bank_transfer";
        }

        // Auto-complete payment section after small delay (visual feedback)
        setTimeout(() => completeSection("payment"), 300);
      });
    });

    // Auto-select bank transfer on load
    const bankOption = document.querySelector(
      '.payment-option[data-method="bank_transfer"]',
    );
    if (bankOption) {
      bankOption.classList.add("selected");
      const bankDetails = document.getElementById("bankTransferDetails");
      if (bankDetails) bankDetails.hidden = false;
    }

    // Copy account number
    const copyBtn = document.getElementById("copyAccountBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const acctNum =
          document
            .getElementById("bankAccountNumber")
            ?.textContent?.replace(/[^0-9]/g, "") || "";
        navigator.clipboard.writeText(acctNum).then(() => {
          showToast("Account number copied!", "success");
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
          }, 2000);
        });
      });
    }

    // Receipt file upload
    const receiptLabel = document.querySelector(".receipt-upload-label");
    const receiptInput = document.getElementById("receiptFile");
    const receiptPreview = document.getElementById("receiptPreview");
    const receiptFileName = document.getElementById("receiptFileName");
    const removeReceiptBtn = document.getElementById("removeReceiptBtn");
    const paymentSentBtn = document.getElementById("paymentSentBtn");

    if (receiptLabel && receiptInput) {
      receiptLabel.addEventListener("click", (e) => {
        // Let the label's for behavior trigger the file input
      });

      receiptInput.addEventListener("change", () => {
        const file = receiptInput.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showToast("File too large. Max 5MB", "error");
          receiptInput.value = "";
          return;
        }
        if (receiptFileName) receiptFileName.textContent = file.name;
        if (receiptPreview) receiptPreview.hidden = false;
        receiptLabel.classList.add("has-file");
        // Enable the confirm button when receipt is uploaded
        if (paymentSentBtn) paymentSentBtn.disabled = false;
      });

      if (removeReceiptBtn) {
        removeReceiptBtn.addEventListener("click", (e) => {
          e.preventDefault();
          receiptInput.value = "";
          if (receiptPreview) receiptPreview.hidden = true;
          receiptLabel.classList.remove("has-file");
          // Disable and reset confirm button when receipt is removed
          if (paymentSentBtn) {
            paymentSentBtn.disabled = true;
            paymentSentBtn.classList.remove("confirmed");
            paymentSentBtn
              .querySelector(".pcb-idle")
              .classList.remove("u-hidden");
            paymentSentBtn
              .querySelector(".pcb-loading")
              .classList.add("u-hidden");
            paymentSentBtn.querySelector(".pcb-done").classList.add("u-hidden");
          }
          // Unmark Payment step green
          updateProgressSteps();
        });
      }
    }

    // "I Have Sent the Payment" button — confirm receipt with loading animation
    if (paymentSentBtn) {
      paymentSentBtn.addEventListener("click", () => {
        if (paymentSentBtn.classList.contains("confirmed")) return;
        const idle = paymentSentBtn.querySelector(".pcb-idle");
        const loading = paymentSentBtn.querySelector(".pcb-loading");
        const done = paymentSentBtn.querySelector(".pcb-done");

        idle.classList.add("u-hidden");
        loading.classList.remove("u-hidden");
        paymentSentBtn.disabled = true;

        setTimeout(() => {
          loading.classList.add("u-hidden");
          done.classList.remove("u-hidden");
          paymentSentBtn.classList.add("confirmed");
          // Update progress — marks Payment step green
          updateProgressSteps();
        }, 2000);
      });
    }
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
        setTimeout(() => toast.classList.remove("show"), 10000);
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
          payment_method: orderData.paymentMethod || "bank_transfer",
          payment_status: orderData.paymentStatus || "awaiting_confirmation",
          payment_receipt_url: orderData.receiptUrl || null,
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
  let _isProcessingPayment = false;

  function handlePlaceOrder() {
    if (_isProcessingPayment) return;
    if (!validateForm()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    const paymentMethod = document.querySelector(
      'input[name="paymentMethod"]:checked',
    )?.value;

    if (paymentMethod === "bank_transfer") {
      // Bank transfer flow: require receipt + confirmation button
      const receiptFile = document.getElementById("receiptFile");
      const paymentSentBtn = document.getElementById("paymentSentBtn");

      if (!receiptFile?.files?.length) {
        showToast("Please upload your payment receipt", "error");
        return;
      }
      if (!paymentSentBtn?.classList.contains("confirmed")) {
        showToast("Please confirm that you have sent the payment", "error");
        return;
      }

      _isProcessingPayment = true;
      processBankTransferOrder();
    } else {
      showToast(
        "This payment method is coming soon. Please use Bank Transfer.",
        "info",
      );
    }
  }

  // Process bank transfer order with receipt upload
  async function processBankTransferOrder() {
    const btn = document.getElementById("placeOrderBtn");
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...';

    const resetBtn = () => {
      _isProcessingPayment = false;
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa-solid fa-lock"></i> <span>Place Order</span>';
    };

    try {
      const orderData = buildOrderData();
      orderData.paymentMethod = "bank_transfer";
      orderData.paymentStatus = "awaiting_confirmation";

      // Upload receipt image to Supabase storage
      let receiptUrl = null;
      const receiptFile = document.getElementById("receiptFile")?.files[0];
      if (receiptFile) {
        const c = window.DB?.client;
        if (c) {
          const ext = receiptFile.name.split(".").pop();
          const fileName = `receipt_${orderData.reference}_${Date.now()}.${ext}`;
          const { data: uploadData, error: uploadError } = await c.storage
            .from("receipts")
            .upload(fileName, receiptFile, { upsert: true });
          if (uploadError) {
            console.warn("Receipt upload failed:", uploadError);
            // Continue anyway — order is still valid
          } else {
            const { data: urlData } = c.storage
              .from("receipts")
              .getPublicUrl(fileName);
            receiptUrl = urlData?.publicUrl || null;
          }
        }
      }

      // Save order to database with pending status
      orderData.receiptUrl = receiptUrl;
      const dbOrder = await saveOrderToDatabase(orderData);

      if (dbOrder && dbOrder.order_number) {
        orderData.reference = dbOrder.order_number;
      }

      // Store confirmed order for confirmation page
      sessionStorage.setItem("LBS_CONFIRMED_ORDER", JSON.stringify(orderData));

      // Clear cart
      localStorage.removeItem(CART_KEY);
      try {
        sessionStorage.removeItem("LBS_FORM__checkout");
      } catch {}
      if (window.APP && window.APP.updateCartBadge)
        window.APP.updateCartBadge();

      showToast("Order placed! We'll confirm your payment shortly.", "success");

      setTimeout(() => {
        window.location.href = "/confirmation";
      }, 1500);
    } catch (err) {
      console.error("CHECKOUT: Bank transfer order error:", err);
      resetBtn();
      showToast("Failed to place order. Please try again.", "error");
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
    const select = document.getElementById("savedAddrSelect");
    if (!picker || !select) return;

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

    picker.classList.remove("u-hidden");
    picker.style.display = "";

    // Clear existing options and add new ones
    select.innerHTML = '<option value="">Use a saved address</option>';
    addrs.forEach((a, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${a.label || "Address " + (i + 1)} - ${a.street}, ${a.city}${a.state ? ", " + a.state : ""}`;
      select.appendChild(opt);
    });

    // Handle selection
    select.addEventListener("change", () => {
      const idx = select.value;
      if (idx === "") return;
      const a = addrs[+idx];
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
      // Trigger floating label
      [addrEl, cityEl, stateEl].forEach((el) => {
        if (el) el.dispatchEvent(new Event("input"));
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

  // Re-show profile info banner if saved data exists and contact fields are empty
  function reshowProfileBanner() {
    if (!_cachedUserFields) return;
    const hasData = Object.values(_cachedUserFields).some((v) => v.trim());
    if (!hasData) return;
    // Only show if at least one field is still empty
    const fieldsEmpty = ["firstName", "lastName", "email", "phone"].some(
      (id) => {
        const el = document.getElementById(id);
        return el && !el.value.trim();
      },
    );
    if (!fieldsEmpty) return;
    const banner = document.getElementById("profileInfoBanner");
    if (banner) banner.classList.remove("u-hidden");
  }

  // Re-show saved address picker when delivery section is opened
  function reshowSavedAddresses() {
    const picker = document.getElementById("savedAddrPicker");
    if (!picker) return;
    let addrs = [];
    try {
      addrs = JSON.parse(localStorage.getItem("LBS_ADDRESSES") || "[]");
    } catch {}
    if (addrs.length) {
      picker.classList.remove("u-hidden");
      picker.style.display = "";
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

    // Re-try profile prefill when auth finishes initializing
    window.addEventListener(
      "auth:changed",
      () => {
        if (!_cachedUserFields) prefillUserInfo();
      },
      { once: true },
    );

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
