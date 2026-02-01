/**
 * ============================================
 * CART PAGE CONTROLLER
 * Lingerie by Sisioyin - Cart & Checkout
 * ============================================
 */
(function () {
  "use strict";
  console.log("🛒 CART: Module initializing");

  /* -------------------------
     DOM REFERENCES
  ------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const cartItemsList = $("#cartItemsList");
  const orderSummary = $("#orderSummary");
  const cartEmpty = $("#cartEmpty");
  const clearCartBtn = $("#clearCartBtn");

  // Exit if not on cart page
  if (!cartItemsList) {
    console.log("🛒 CART: Not on cart page, exiting");
    return;
  }

  // Summary elements
  const subtotalEl = $("#summarySubtotal");
  const deliveryEl = $("#summaryDelivery");
  const totalEl = $("#summaryTotal");
  const discountEl = $("#summaryDiscount");
  const discountRow = $("#discountRow");
  const itemCountEl = $("#itemCount");

  // Promo code elements
  const promoForm = $("#promoForm");
  const promoInput = $("#promoInput");
  const promoFormContainer = $("#promoFormContainer");
  const promoApplied = $("#promoApplied");
  const promoAppliedText = $("#promoAppliedText");
  const removePromoBtn = $("#removePromo");

  // Delivery & checkout
  const deliverySelect = $("#deliveryArea");
  const orderNote = $("#orderNote");
  const checkoutBtn = $("#checkoutBtn");
  const checkoutPaystack = $("#checkoutPaystack");

  // Current promo
  let appliedPromo = null;

  /* -------------------------
     HELPERS
  ------------------------- */
  const formatMoney = (n) =>
    window.UTILS?.formatNaira?.(n) ?? `₦${Number(n || 0).toLocaleString()}`;

  function getDeliveryFee() {
    const selected = deliverySelect?.querySelector("option:checked");
    if (!selected) return 0;
    const fee = selected.getAttribute("data-fee");
    return fee ? parseInt(fee, 10) : 0;
  }

  function generateOrderId() {
    const now = Date.now();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LBS-${now.toString(36).toUpperCase()}-${rand}`;
  }

  /* -------------------------
     RENDER CART ITEMS
  ------------------------- */
  function renderCart() {
    console.log("🛒 CART: renderCart()");
    const cart = window.APP?.getCart?.() || [];
    console.log("🛒 CART: Cart has", cart.length, "items");
    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

    // Update item count badge
    if (itemCountEl) {
      itemCountEl.textContent = `${count} item${count !== 1 ? "s" : ""}`;
    }

    // Empty state
    if (!cart.length) {
      cartItemsList.innerHTML = "";
      cartItemsList.hidden = true;
      if (cartEmpty) cartEmpty.hidden = false;
      if (orderSummary) orderSummary.hidden = true;
      if (clearCartBtn) clearCartBtn.hidden = true;
      if (checkoutBtn) checkoutBtn.disabled = true;
      if (checkoutPaystack) checkoutPaystack.disabled = true;
      updateSummary(0);
      return;
    }

    // Has items - show cart items and order summary
    cartItemsList.hidden = false;
    if (cartEmpty) cartEmpty.hidden = true;
    if (orderSummary) orderSummary.hidden = false;
    if (clearCartBtn) clearCartBtn.hidden = false;
    if (checkoutBtn) checkoutBtn.disabled = false;

    let subtotal = 0;

    cartItemsList.innerHTML = cart
      .map((item) => {
        const qty = Number(item.qty || 1);
        const price = Number(item.price_ngn || 0);
        const lineTotal = qty * price;
        subtotal += lineTotal;

        const name =
          window.UTILS?.safeText?.(item.name) || item.name || "Product";
        const size =
          window.UTILS?.safeText?.(item.selectedSize) ||
          item.selectedSize ||
          "One Size";
        const color = item.selectedColor || "";
        const img = item.image || "assets/img/placeholder.png";
        const vid = window.UTILS?.safeText?.(item.variantId) || item.variantId;

        return `
        <article class="cart-item" data-variant-id="${vid}">
          <div class="cart-item-image">
            <img src="${img}" alt="${name}" loading="lazy">
          </div>
          
          <div class="cart-item-content">
            <div class="cart-item-header">
              <div class="cart-item-info">
                <h3 class="cart-item-name">${name}</h3>
                <div class="cart-item-meta">
                  <span><i class="fa-solid fa-ruler"></i> ${size}</span>
                  ${color ? `<span><i class="fa-solid fa-palette"></i> ${color}</span>` : ""}
                </div>
              </div>
              <button type="button" class="cart-item-remove" data-action="remove" aria-label="Remove item">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
            
            <div class="cart-item-footer">
              <div class="cart-item-quantity">
                <button type="button" class="qty-btn" data-action="dec" aria-label="Decrease quantity">
                  <i class="fas fa-minus"></i>
                </button>
                <span class="qty-value">${qty}</span>
                <button type="button" class="qty-btn" data-action="inc" aria-label="Increase quantity">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              
              <div class="cart-item-price">
                <span class="line-total">${formatMoney(lineTotal)}</span>
                <span class="unit-price">${formatMoney(price)} each</span>
              </div>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    updateSummary(subtotal);
  }

  /* -------------------------
     UPDATE ORDER SUMMARY
  ------------------------- */
  function updateSummary(subtotal = 0) {
    console.log("🛒 CART: updateSummary() subtotal:", subtotal);
    const deliveryFee = getDeliveryFee();

    // Calculate discount
    let discount = 0;
    if (appliedPromo && appliedPromo.discount_percent) {
      discount = Math.round(subtotal * (appliedPromo.discount_percent / 100));
    }

    const total = subtotal - discount + deliveryFee;
    console.log(
      "🛒 CART: Delivery fee:",
      deliveryFee,
      "Discount:",
      discount,
      "Total:",
      total,
    );

    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (discountEl && discountRow) {
      if (discount > 0) {
        discountEl.textContent = `-${formatMoney(discount)}`;
        discountRow.hidden = false;
      } else {
        discountRow.hidden = true;
      }
    }
    if (deliveryEl)
      deliveryEl.textContent = deliveryFee
        ? formatMoney(deliveryFee)
        : "Select area";
    if (totalEl) totalEl.textContent = formatMoney(total);
  }

  /* -------------------------
     CALCULATE CURRENT SUBTOTAL
  ------------------------- */
  function calculateSubtotal() {
    console.log("🛒 CART: calculateSubtotal()");
    const cart = window.APP?.getCart?.() || [];
    const subtotal = cart.reduce((sum, item) => {
      return sum + Number(item.qty || 1) * Number(item.price_ngn || 0);
    }, 0);
    console.log("🛒 CART: Calculated subtotal:", subtotal);
    return subtotal;
  }

  /* -------------------------
     PROMO CODE HANDLERS
  ------------------------- */
  if (promoForm) {
    promoForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = promoInput?.value?.trim().toUpperCase();
      if (!code) return;

      try {
        const result = await window.APP?.applyPromoCode?.(code);
        if (result && result.valid) {
          appliedPromo = result.promo;
          promoFormContainer.hidden = true;
          promoApplied.hidden = false;
          promoAppliedText.textContent = `${code} (-${result.promo.discount_percent}%)`;
          updateSummary(calculateSubtotal());
          window.UTILS?.toast?.(
            `Promo code applied: ${result.promo.discount_percent}% off!`,
            "success",
          );
        } else {
          window.UTILS?.toast?.(
            result?.message || "Invalid promo code",
            "error",
          );
        }
      } catch (err) {
        console.error("Promo error:", err);
        window.UTILS?.toast?.("Error applying promo code", "error");
      }
    });
  }

  if (removePromoBtn) {
    removePromoBtn.addEventListener("click", () => {
      appliedPromo = null;
      window.APP?.removePromo?.();
      promoFormContainer.hidden = false;
      promoApplied.hidden = true;
      promoInput.value = "";
      updateSummary(calculateSubtotal());
      window.UTILS?.toast?.("Promo code removed", "info");
    });
  }

  /* -------------------------
     EVENT HANDLERS
  ------------------------- */

  // Cart item actions (delegation)
  cartItemsList.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.getAttribute("data-action");
    const row = target.closest("[data-variant-id]");
    const variantId = row?.getAttribute("data-variant-id");

    if (!variantId) return;

    console.log("🛒 CART: Item action -", action, "on", variantId);

    switch (action) {
      case "inc":
        window.APP?.changeQty?.(variantId, +1);
        break;
      case "dec":
        window.APP?.changeQty?.(variantId, -1);
        break;
      case "remove":
        window.APP?.removeFromCart?.(variantId);
        window.UTILS?.toast?.("Item removed from cart");
        break;
    }
  });

  // Delivery area change
  deliverySelect?.addEventListener("change", () => {
    console.log("🛒 CART: Delivery area changed to:", deliverySelect.value);
    updateSummary(calculateSubtotal());
  });

  // Clear cart
  clearCartBtn?.addEventListener("click", () => {
    console.log("🛒 CART: Clear cart clicked");
    if (!confirm("Are you sure you want to clear your cart?")) return;
    window.APP?.setCart?.([]);
    renderCart();
    window.UTILS?.toast?.("Cart cleared");
  });

  // WhatsApp checkout
  checkoutBtn?.addEventListener("click", () => {
    console.log("🛒 CART: WhatsApp checkout clicked");
    const cart = window.APP?.getCart?.() || [];

    if (!cart.length) {
      return window.UTILS?.toast?.("Your cart is empty", "warning");
    }

    const area = deliverySelect?.value;
    if (!area) {
      return window.UTILS?.toast?.("Please select a delivery area", "warning");
    }

    const note = orderNote?.value?.trim() || "";
    const orderId = generateOrderId();

    // Build order lines
    let subtotal = 0;
    const lines = cart
      .map((item) => {
        const qty = Number(item.qty || 1);
        const price = Number(item.price_ngn || 0);
        const lineTotal = qty * price;
        subtotal += lineTotal;

        const size = item.selectedSize || "One Size";
        const color = item.selectedColor ? ` / ${item.selectedColor}` : "";

        return `• ${qty}x ${item.name} (${size}${color}) — ${formatMoney(lineTotal)}`;
      })
      .join("\n");

    const deliveryFee = getDeliveryFee();
    const total = subtotal + deliveryFee;

    // Format WhatsApp message
    const message = [
      `🛍️ *NEW ORDER: ${orderId}*`,
      "",
      "*Items:*",
      lines,
      "",
      `*Subtotal:* ${formatMoney(subtotal)}`,
      `*Delivery (${area}):* ${formatMoney(deliveryFee)}`,
      `*Total:* ${formatMoney(total)}`,
      note ? `\n*Note:* ${note}` : "",
      "",
      "---",
      "Please confirm availability and send payment details.",
    ]
      .filter(Boolean)
      .join("\n");

    // Get WhatsApp number from config
    const phoneNumber = window.APP_CONFIG?.WHATSAPP_NUMBER || "2348000000000";
    const waUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    console.log("🛒 CART: Opening WhatsApp with order", orderId);

    // Open WhatsApp
    window.open(waUrl, "_blank");

    // Clear cart after successful checkout
    window.APP?.setCart?.([]);
    renderCart();

    window.UTILS?.toast?.("Order sent to WhatsApp!", "success");
  });

  /* -------------------------
     PAYSTACK CHECKOUT
  ------------------------- */
  if (checkoutPaystack) {
    checkoutPaystack.addEventListener("click", () => {
      const cart = window.APP?.getCart?.() || [];

      if (!cart.length) {
        return window.UTILS?.toast?.("Your cart is empty", "warning");
      }

      const area = deliverySelect?.value;
      if (!area) {
        return window.UTILS?.toast?.(
          "Please select a delivery area",
          "warning",
        );
      }

      // Prompt for email
      const email = prompt("Enter your email address for payment:");
      if (!email || !email.includes("@")) {
        return window.UTILS?.toast?.(
          "Valid email required for payment",
          "warning",
        );
      }

      const subtotal = calculateSubtotal();
      const deliveryFee = getDeliveryFee();

      // Calculate discount
      let discount = 0;
      if (appliedPromo && appliedPromo.discount_percent) {
        discount = Math.round(subtotal * (appliedPromo.discount_percent / 100));
      }

      const total = subtotal - discount + deliveryFee;
      const orderId = generateOrderId();

      // Paystack configuration
      const paystackKey =
        window.APP_CONFIG?.PAYSTACK_PUBLIC_KEY || "pk_test_xxxxx";

      if (!window.PaystackPop) {
        return window.UTILS?.toast?.(
          "Payment system loading. Please try again.",
          "warning",
        );
      }

      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email: email,
        amount: total * 100, // Paystack uses kobo
        currency: "NGN",
        ref: orderId,
        metadata: {
          custom_fields: [
            {
              display_name: "Order ID",
              variable_name: "order_id",
              value: orderId,
            },
            {
              display_name: "Delivery Area",
              variable_name: "delivery_area",
              value: area,
            },
          ],
          cart_items: cart.map((item) => ({
            name: item.name,
            qty: item.qty,
            size: item.selectedSize,
            price: item.price_ngn,
          })),
        },
        callback: function (response) {
          console.log("🛒 CART: Payment successful", response);

          // Save order to database
          saveOrder(
            orderId,
            email,
            cart,
            subtotal,
            discount,
            deliveryFee,
            total,
            area,
            response.reference,
          );

          // Clear cart
          window.APP?.setCart?.([]);
          appliedPromo = null;
          renderCart();

          window.UTILS?.toast?.(
            "Payment successful! Order confirmed.",
            "success",
          );

          // Redirect to success or show modal
          setTimeout(() => {
            alert(
              `Thank you for your order!\n\nOrder ID: ${orderId}\nTotal: ${formatMoney(total)}\n\nYou will receive a confirmation shortly.`,
            );
          }, 500);
        },
        onClose: function () {
          window.UTILS?.toast?.("Payment cancelled", "info");
        },
      });

      handler.openIframe();
    });
  }

  /* -------------------------
     SAVE ORDER TO DATABASE
  ------------------------- */
  async function saveOrder(
    orderId,
    email,
    cart,
    subtotal,
    discount,
    deliveryFee,
    total,
    area,
    paymentRef,
  ) {
    try {
      const orderData = {
        order_number: orderId,
        customer_email: email,
        items: cart.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          name: item.name,
          size: item.selectedSize,
          color: item.selectedColor,
          qty: item.qty,
          price: item.price_ngn,
        })),
        subtotal: subtotal,
        discount_amount: discount,
        promo_code: appliedPromo?.code || null,
        delivery_fee: deliveryFee,
        total: total,
        delivery_area: area,
        payment_method: "paystack",
        payment_status: "paid",
        payment_reference: paymentRef,
        status: "confirmed",
      };

      const { error } = await window.DB?.client
        ?.from("orders")
        ?.insert([orderData]);

      if (error) {
        console.error("Error saving order:", error);
      } else {
        console.log("Order saved successfully:", orderId);
      }
    } catch (err) {
      console.error("Failed to save order:", err);
    }
  }

  /* -------------------------
     LISTEN FOR CART UPDATES
  ------------------------- */
  window.addEventListener("cart:updated", () => {
    console.log("🛒 CART: cart:updated event received");
    renderCart();
  });

  /* -------------------------
     INITIALIZE
  ------------------------- */
  renderCart();

  console.log("✅ CART: Page initialized");
})();
