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

  // Current promo
  let appliedPromo = null;

  // Direct cart access from localStorage - most reliable method
  const CART_KEY = "LBS_CART_V1";

  /* -------------------------
     HELPERS
  ------------------------- */
  const formatMoney = (n) =>
    window.UTILS?.formatNaira?.(n) ?? `₦${Number(n || 0).toLocaleString()}`;

  function getDeliveryFee() {
    const deliverySelect = $("#deliveryArea");
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

  function getCart() {
    try {
      // Method 1: Direct localStorage read
      const raw = localStorage.getItem(CART_KEY);

      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          console.log("🛒 CART: getCart() found", data.length, "items");
          return data;
        }
      }

      // Method 2: Try APP.getCart if available
      if (window.APP?.getCart) {
        const appCart = window.APP.getCart();
        if (Array.isArray(appCart) && appCart.length > 0) {
          return appCart;
        }
      }

      return [];
    } catch (e) {
      console.error("🛒 CART: Error reading cart", e);
      return [];
    }
  }

  /* -------------------------
     RENDER CART ITEMS
  ------------------------- */
  function renderCart() {
    console.log("🛒 CART: renderCart() called");

    // Query elements fresh every time
    const wrapper = $("#cartWrapper");
    const emptyState = $("#cartPageEmpty");
    const itemsList = $("#cartItemsList");
    const clearBtn = $("#clearCartBtn");
    const countEl = $("#itemCount");

    console.log(
      "🛒 CART: Elements - wrapper:",
      !!wrapper,
      "emptyState:",
      !!emptyState,
      "itemsList:",
      !!itemsList,
    );

    if (!itemsList) {
      console.log("🛒 CART: No itemsList element, skipping render");
      return;
    }

    const cart = getCart();
    console.log("🛒 CART: Cart has", cart.length, "items");

    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

    // Update item count text
    if (countEl) {
      countEl.textContent = `${count} item${count !== 1 ? "s" : ""} in your cart`;
    }

    // Empty state
    if (!cart.length) {
      console.log("🛒 CART: No items - showing empty state");
      itemsList.innerHTML = "";
      if (wrapper) wrapper.style.display = "none";
      if (emptyState) emptyState.style.display = "flex";
      if (clearBtn) clearBtn.style.display = "none";
      updateSummary(0);
      return;
    }

    // Has items - show cart wrapper, hide empty state
    console.log("🛒 CART: Has items - showing cart wrapper");
    if (wrapper) {
      wrapper.style.display = "grid";
    }
    if (emptyState) {
      emptyState.style.display = "none";
    }
    if (clearBtn) clearBtn.style.display = "inline-flex";

    let subtotal = 0;

    itemsList.innerHTML = cart
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
    const subtotalEl = $("#summarySubtotal");
    const deliveryEl = $("#summaryDelivery");
    const totalEl = $("#summaryTotal");
    const discountEl = $("#summaryDiscount");
    const discountRow = $("#discountRow");

    const deliveryFee = getDeliveryFee();

    // Calculate discount
    let discount = 0;
    if (appliedPromo && appliedPromo.discount_percent) {
      discount = Math.round(subtotal * (appliedPromo.discount_percent / 100));
    }

    const total = subtotal - discount + deliveryFee;

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
    const cart = getCart();
    return cart.reduce((sum, item) => {
      return sum + Number(item.qty || 1) * Number(item.price_ngn || 0);
    }, 0);
  }

  /* -------------------------
     PROMO CODE HANDLERS
  ------------------------- */
  async function applyPromoCode() {
    const promoInput = $("#promoInput");
    const promoFormContainer = $("#promoFormContainer");
    const promoApplied = $("#promoApplied");
    const promoAppliedText = $("#promoAppliedText");

    const code = promoInput?.value?.trim().toUpperCase();
    if (!code) return;

    try {
      const result = await window.applyPromoCode?.(code);
      if (result && result.valid) {
        appliedPromo = { discount_percent: result.discount };
        if (promoFormContainer) promoFormContainer.style.display = "none";
        if (promoApplied) promoApplied.style.display = "flex";
        if (promoAppliedText)
          promoAppliedText.textContent = `${code} (-${result.discount}%)`;
        updateSummary(calculateSubtotal());
        window.UTILS?.toast?.(result.message, "success");
      } else {
        window.UTILS?.toast?.(result?.message || "Invalid promo code", "error");
      }
    } catch (err) {
      console.error("Promo error:", err);
      window.UTILS?.toast?.("Error applying promo code", "error");
    }
  }

  function removePromoCode() {
    const promoInput = $("#promoInput");
    const promoFormContainer = $("#promoFormContainer");
    const promoApplied = $("#promoApplied");

    appliedPromo = null;
    window.removePromo?.();
    if (promoFormContainer) promoFormContainer.style.display = "block";
    if (promoApplied) promoApplied.style.display = "none";
    if (promoInput) promoInput.value = "";
    updateSummary(calculateSubtotal());
    window.UTILS?.toast?.("Promo code removed", "info");
  }

  /* -------------------------
     SETUP EVENT HANDLERS
  ------------------------- */
  function setupEventHandlers() {
    const cartItemsList = $("#cartItemsList");
    const clearCartBtn = $("#clearCartBtn");
    const applyPromoBtn = $("#applyPromoBtn");
    const promoInput = $("#promoInput");
    const removePromoBtn = $("#removePromo");
    const deliverySelect = $("#deliveryArea");

    // Cart item actions (delegation)
    if (cartItemsList) {
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
    }

    // Delivery area change
    if (deliverySelect) {
      deliverySelect.addEventListener("change", () => {
        updateSummary(calculateSubtotal());
      });
    }

    // Clear cart
    if (clearCartBtn) {
      clearCartBtn.addEventListener("click", () => {
        if (!confirm("Are you sure you want to clear your cart?")) return;
        window.APP?.setCart?.([]);
        renderCart();
        window.UTILS?.toast?.("Cart cleared");
      });
    }

    // Promo code apply
    if (applyPromoBtn) {
      applyPromoBtn.addEventListener("click", applyPromoCode);
    }

    // Promo code enter key
    if (promoInput) {
      promoInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyPromoCode();
        }
      });
    }

    // Remove promo
    if (removePromoBtn) {
      removePromoBtn.addEventListener("click", removePromoCode);
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
  function init() {
    console.log("🛒 CART: init() called");

    // Check if we're on the cart page
    const cartItemsList = $("#cartItemsList");
    if (!cartItemsList) {
      console.log("🛒 CART: Not on cart page, exiting");
      return;
    }

    console.log("🛒 CART: On cart page, setting up...");

    // Setup event handlers
    setupEventHandlers();

    // Render cart immediately
    renderCart();

    console.log("✅ CART: Page initialized");
  }

  // Run init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM already loaded
    init();
  }
})();
