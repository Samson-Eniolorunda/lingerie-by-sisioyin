/**
 * Lingerie by Sisioyin - Core Application
 * Handles cart, theme, modals, navigation, and global state
 */

(function () {
  "use strict";

  console.log("🚀 APP: Initializing core application...");

  /* ─────────────────────────────────────────────
   * Constants
   * ───────────────────────────────────────────── */
  const CART_KEY = "LBS_CART_V1";
  const THEME_KEY = "LBS_THEME";
  const WISHLIST_KEY = "LBS_WISHLIST";

  /* ─────────────────────────────────────────────
   * State
   * ───────────────────────────────────────────── */
  let modalProduct = null;
  let modalSelectedSize = "";
  let modalQuantity = 1;

  /* ─────────────────────────────────────────────
   * Utilities
   * ───────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

  function getClient() {
    return window.DB?.client || null;
  }

  function emit(eventName, detail = {}) {
    console.log(`📡 APP: Emitting event "${eventName}"`, detail);
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  function buildVariantId(productId, size, color = "") {
    const sizeStr = String(size || "One Size").trim();
    const colorStr = color ? `-${String(color).trim()}` : "";
    return `${productId}-${sizeStr}${colorStr}`;
  }

  function normalizeSizes(product) {
    const raw = Array.isArray(product?.sizes)
      ? product.sizes
      : UTILS.parseCSV(product?.sizes);
    const clean = raw
      .map((s) => {
        // Handle object format {name: "S", qty: 10}
        if (typeof s === "object" && s !== null) {
          return { name: String(s.name || "").trim(), qty: s.qty || 0 };
        }
        // Handle string format
        return { name: String(s).trim(), qty: 1 };
      })
      .filter((s) => s.name);
    return clean.length ? clean : [{ name: "One Size", qty: 1 }];
  }

  function getFirstImage(images) {
    if (Array.isArray(images) && images.length) return images[0];
    if (typeof images === "string" && images.trim())
      return images.split(",")[0].trim();
    return "https://placehold.co/400x400/f8fafc/be185d?text=No+Image";
  }

  async function fetchProductById(id) {
    console.log(`📦 APP: Fetching product by ID: ${id}`);
    const client = getClient();
    if (!client) return null;

    const { data, error } = await client
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("❌ APP: Error fetching product:", error);
      return null;
    }
    console.log("✅ APP: Product fetched:", data?.name);
    return data || null;
  }

  /* ─────────────────────────────────────────────
   * Cart Management
   * ───────────────────────────────────────────── */
  function getCart() {
    const cart = UTILS.loadJSON(CART_KEY, []);
    console.log(`🛒 APP: getCart() - ${cart.length} items`);
    return cart;
  }

  function setCart(cart) {
    console.log(`🛒 APP: setCart() - ${cart.length} items`);
    UTILS.saveJSON(CART_KEY, cart);
    updateCartBadge();
    renderCartDrawer();
    emit("cart:updated");
  }

  function addToCart(item) {
    console.log(`➕ APP: addToCart() - ${item.name}`);
    const cart = getCart();
    const existing = cart.find((i) => i.variantId === item.variantId);

    if (existing) {
      existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
      console.log(`🔄 APP: Updated existing item qty to ${existing.qty}`);
    } else {
      cart.push({ ...item, qty: Number(item.qty || 1) });
      console.log("🆕 APP: Added new item to cart");
    }

    setCart(cart);
    openDrawer();
    UTILS.toast(`${item.name} added to cart`, "success");
  }

  function removeFromCart(variantId) {
    console.log(`🗑️ APP: removeFromCart() - ${variantId}`);
    const cart = getCart().filter((i) => i.variantId !== variantId);
    setCart(cart);
    UTILS.toast("Item removed from cart", "info");
  }

  function changeQty(variantId, delta) {
    console.log(`📊 APP: changeQty() - ${variantId}, delta: ${delta}`);
    const cart = getCart();
    const item = cart.find((i) => i.variantId === variantId);
    if (!item) return;

    const newQty = Math.max(1, Number(item.qty || 1) + delta);
    item.qty = newQty;
    console.log(`📊 APP: New qty: ${newQty}`);
    setCart(cart);
  }

  function clearCart() {
    console.log("🧹 APP: clearCart()");
    setCart([]);
    UTILS.toast("Cart cleared", "info");
  }

  function updateCartBadge() {
    const count = getCart().reduce((sum, i) => sum + Number(i.qty || 0), 0);
    console.log(`🏷️ APP: updateCartBadge() - ${count} items`);
    $$("[data-cart-count]").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  /* ─────────────────────────────────────────────
   * Wishlist Management
   * ───────────────────────────────────────────── */
  function getWishlist() {
    const wishlist = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    console.log(`❤️ APP: getWishlist() - ${wishlist.length} items`);
    return wishlist;
  }

  function setWishlist(wishlist) {
    console.log(`❤️ APP: setWishlist() - ${wishlist.length} items`);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    emit("wishlist:updated");
  }

  function toggleWishlist(productId) {
    console.log(`❤️ APP: toggleWishlist() - ${productId}`);
    const wishlist = getWishlist();
    const id = String(productId);
    const index = wishlist.indexOf(id);

    if (index > -1) {
      wishlist.splice(index, 1);
      UTILS.toast("Removed from wishlist", "info");
    } else {
      wishlist.push(id);
      UTILS.toast("Added to wishlist", "success");
    }

    setWishlist(wishlist);
    return index === -1; // Returns true if added, false if removed
  }

  function isInWishlist(productId) {
    return getWishlist().includes(String(productId));
  }

  /* ─────────────────────────────────────────────
   * Cart Drawer (Modern Design)
   * ───────────────────────────────────────────── */

  // Color hex helper
  function getColorHex(colorName) {
    const colorMap = {
      Black: "#000000",
      White: "#FFFFFF",
      Red: "#EF4444",
      Pink: "#EC4899",
      Blue: "#3B82F6",
      Navy: "#1E3A5F",
      Green: "#22C55E",
      Purple: "#A855F7",
      Orange: "#F97316",
      Yellow: "#EAB308",
      Brown: "#92400E",
      Beige: "#D4B896",
      Gray: "#6B7280",
      Grey: "#6B7280",
      Cream: "#FFFDD0",
      Gold: "#FFD700",
      Silver: "#C0C0C0",
      Nude: "#E3BC9A",
      Burgundy: "#800020",
      Maroon: "#800000",
      Coral: "#FF7F50",
      Teal: "#008080",
      Lavender: "#E6E6FA",
      Mint: "#98FF98",
      Peach: "#FFCBA4",
    };
    return colorMap[colorName] || "#CBD5E1";
  }

  function openDrawer() {
    console.log("📂 APP: openDrawer()");
    const drawer = $("#cartDrawer");
    const overlay = $("#cartDrawerOverlay");
    if (!drawer) {
      console.log("⚠️ APP: Cart drawer not found");
      return;
    }

    // Remove inert/aria-hidden BEFORE rendering so focus can work
    drawer.removeAttribute("inert");
    drawer.setAttribute("aria-hidden", "false");

    renderCartDrawer();
    drawer.classList.add("open");
    overlay?.classList.add("open");
    document.body.style.overflow = "hidden";
    document.body.classList.add("drawer-open");

    // Focus the close button for keyboard accessibility
    const closeBtn = drawer.querySelector("#closeCartDrawer");
    closeBtn?.focus();
  }

  function closeDrawer() {
    console.log("📁 APP: closeDrawer()");
    const drawer = $("#cartDrawer");
    const overlay = $("#cartDrawerOverlay");
    if (!drawer) return;

    drawer.classList.remove("open");
    overlay?.classList.remove("open");
    document.body.style.overflow = "";
    document.body.classList.remove("drawer-open");

    // Set inert/aria-hidden AFTER removing focus
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("inert", "");
  }

  function renderCartDrawer() {
    console.log("🎨 APP: renderCartDrawer()");

    // Modern cart drawer elements
    const cartDrawerBody = $("#cartDrawerBody");
    const cartDrawerFooter = $("#cartDrawerFooter");
    const cartEmpty = $("#cartEmpty");
    const subtotalEl = $("#cartSubtotal");

    // Fallback to old drawer elements
    const oldList = $("[data-drawer-list]") || $(".drawer-items");
    const oldSubtotal = $("[data-drawer-subtotal]") || $(".drawer-subtotal");

    const cart = getCart();
    let subtotal = 0;

    // Handle modern cart drawer (cd-* classes)
    if (cartDrawerBody) {
      // Remove existing items
      cartDrawerBody.querySelectorAll(".cd-item").forEach((el) => el.remove());

      if (!cart.length) {
        if (cartEmpty) cartEmpty.style.display = "flex";
        if (cartDrawerFooter) cartDrawerFooter.style.display = "none";
        return;
      }

      if (cartEmpty) cartEmpty.style.display = "none";
      if (cartDrawerFooter) cartDrawerFooter.style.display = "block";

      cart.forEach((item, idx) => {
        const qty = Number(item.qty || 1);
        const price = Number(item.price_ngn || 0);
        subtotal += price * qty;

        const colorName = item.selectedColor || "";
        const colorHex = getColorHex(colorName);

        const itemEl = document.createElement("div");
        itemEl.className = "cd-item";
        itemEl.dataset.idx = idx;
        itemEl.innerHTML = `
          <img src="${item.image || "https://placehold.co/72x90/f8fafc/be185d?text=No+Image"}" alt="${UTILS.safeText(item.name)}" class="cd-item-img">
          <div class="cd-item-info">
            <h4 class="cd-item-name">${UTILS.safeText(item.name)}</h4>
            <div class="cd-item-variant">
              ${item.selectedSize ? `<span class="cd-variant-tag">${item.selectedSize}</span>` : ""}
              ${colorName ? `<span class="cd-variant-tag"><span class="cd-color-dot" style="background:${colorHex}"></span>${colorName}</span>` : ""}
            </div>
            <div class="cd-item-bottom">
              <p class="cd-item-price">${UTILS.formatNaira(price)}</p>
              <div class="cd-item-qty">
                <button type="button" class="cd-qty-btn cd-qty-minus" data-idx="${idx}"><i class="fa-solid fa-minus"></i></button>
                <span class="cd-qty-value">${qty}</span>
                <button type="button" class="cd-qty-btn cd-qty-plus" data-idx="${idx}"><i class="fa-solid fa-plus"></i></button>
              </div>
            </div>
          </div>
          <button type="button" class="cd-item-remove" data-idx="${idx}" aria-label="Remove item"><i class="fa-solid fa-trash-can"></i></button>
        `;
        cartDrawerBody.appendChild(itemEl);
      });

      if (subtotalEl) subtotalEl.textContent = UTILS.formatNaira(subtotal);
      return;
    }

    // Fallback to old drawer structure
    if (!oldList) return;

    if (!cart.length) {
      oldList.innerHTML = `
        <div class="drawer-empty">
          <i class="fa-solid fa-bag-shopping"></i>
          <p>Your cart is empty</p>
          <a href="shop.html" class="btn btn-primary btn-sm">Start Shopping</a>
        </div>
      `;
      if (oldSubtotal) oldSubtotal.textContent = UTILS.formatNaira(0);
      return;
    }

    oldList.innerHTML = cart
      .map((item, idx) => {
        const qty = Number(item.qty || 1);
        const price = Number(item.price_ngn || 0);
        const lineTotal = price * qty;
        subtotal += lineTotal;

        return `
        <div class="drawer-item" data-variant-id="${UTILS.safeText(item.variantId)}" data-idx="${idx}">
          <img src="${UTILS.safeText(item.image)}" alt="${UTILS.safeText(item.name)}" class="drawer-item-img" loading="lazy" />
          <div class="drawer-item-info">
            <h4 class="drawer-item-name">${UTILS.safeText(item.name)}</h4>
            <p class="drawer-item-size">${UTILS.safeText(item.selectedSize || "One Size")}</p>
            <div class="drawer-item-qty">
              <button type="button" class="qty-btn" data-action="dec" aria-label="Decrease">
                <i class="fa-solid fa-minus"></i>
              </button>
              <span>${qty}</span>
              <button type="button" class="qty-btn" data-action="inc" aria-label="Increase">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>
          <div class="drawer-item-right">
            <span class="drawer-item-price">${UTILS.formatNaira(lineTotal)}</span>
            <button type="button" class="drawer-item-remove" data-action="remove" aria-label="Remove">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    if (oldSubtotal) oldSubtotal.textContent = UTILS.formatNaira(subtotal);
  }

  // Cart drawer item quantity/remove handlers
  function updateCartItemQty(idx, delta) {
    const cart = getCart();
    if (!cart[idx]) return;

    cart[idx].qty = Math.max(1, Math.min(99, (cart[idx].qty || 1) + delta));
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
    renderCartDrawer();
  }

  function removeCartItemByIndex(idx) {
    const cart = getCart();
    cart.splice(idx, 1);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
    renderCartDrawer();
    showToast("Item removed", "info");
  }

  /* ─────────────────────────────────────────────
   * Quick View Modal - Image Gallery Support
   * ───────────────────────────────────────────── */
  let modalImages = [];
  let currentImageIndex = 0;

  function updateGalleryImage(index) {
    const imgEl = $("#modalImg");
    const thumbs = $$("#modalThumbs .gallery-thumb");
    const prevBtn = $("#galleryPrev");
    const nextBtn = $("#galleryNext");

    if (!imgEl || !modalImages.length) return;

    currentImageIndex = index;
    imgEl.src = modalImages[index];
    imgEl.classList.add("fade-in");
    setTimeout(() => imgEl.classList.remove("fade-in"), 300);

    // Update active thumb
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle("active", i === index);
    });

    // Update nav buttons visibility
    if (prevBtn) prevBtn.hidden = modalImages.length <= 1;
    if (nextBtn) nextBtn.hidden = modalImages.length <= 1;
  }

  /* ─────────────────────────────────────────────
   * Image Lightbox Preview
   * ───────────────────────────────────────────── */
  function openImagePreview(startIdx = 0) {
    let idx = startIdx;
    const overlay = document.createElement("div");
    overlay.className = "img-lightbox";

    const render = () => {
      overlay.innerHTML = `
        <button class="lb-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="lb-content">
          ${modalImages.length > 1 ? '<button class="lb-nav lb-prev"><i class="fa-solid fa-chevron-left"></i></button>' : ""}
          <img src="${modalImages[idx]}" alt="Preview" />
          ${modalImages.length > 1 ? '<button class="lb-nav lb-next"><i class="fa-solid fa-chevron-right"></i></button>' : ""}
        </div>
        <div class="lb-counter">${idx + 1} / ${modalImages.length}</div>
        <div class="lb-actions">
          <button class="lb-download"><i class="fa-solid fa-download"></i> Download</button>
        </div>
      `;
    };

    render();
    document.body.appendChild(overlay);

    overlay.addEventListener("click", async (e) => {
      if (e.target === overlay || e.target.closest(".lb-close")) {
        overlay.remove();
        return;
      }
      if (e.target.closest(".lb-prev")) {
        idx = (idx - 1 + modalImages.length) % modalImages.length;
        render();
      }
      if (e.target.closest(".lb-next")) {
        idx = (idx + 1) % modalImages.length;
        render();
      }
      if (e.target.closest(".lb-download")) {
        try {
          const res = await fetch(modalImages[idx]);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `image-${idx + 1}.jpg`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch {
          showToast("Failed to download image", "error");
        }
      }
    });
  }

  let modalSelectedColor = "";

  // Color name to hex mapping
  const colorMap = {
    black: "#000000",
    white: "#ffffff",
    red: "#ef4444",
    pink: "#ec4899",
    rose: "#f43f5e",
    blue: "#3b82f6",
    navy: "#1e3a5a",
    green: "#22c55e",
    purple: "#a855f7",
    yellow: "#eab308",
    orange: "#f97316",
    brown: "#92400e",
    beige: "#d4a373",
    nude: "#e8cebf",
    cream: "#fffdd0",
    gray: "#6b7280",
    grey: "#6b7280",
    gold: "#d4af37",
    silver: "#c0c0c0",
    burgundy: "#800020",
    maroon: "#800000",
    coral: "#ff7f50",
    peach: "#ffcba4",
    lavender: "#e6e6fa",
    teal: "#008080",
    mint: "#98ff98",
    champagne: "#f7e7ce",
  };

  function getColorValue(name) {
    const key = (name || "").toLowerCase().trim();
    return colorMap[key] || key || "#cccccc";
  }

  function openModal(productOrId) {
    console.log("🔍 APP: openModal()", productOrId);
    // Try new overlay or old modal
    const overlay = $("#quickViewOverlay");
    const modal = $("#variantModal") || $("#quickViewModal");
    if (!overlay && !modal) {
      console.log("⚠️ APP: Modal not found");
      return;
    }

    const populate = (product) => {
      console.log("🔍 APP: Populating modal with:", product?.name);
      modalProduct = product;
      modalSelectedSize = "";
      modalSelectedColor = "";
      modalQuantity = 1;
      currentImageIndex = 0;

      // Get modal elements
      const imgEl = $("#modalImg");
      const titleEl = $("#modalTitle");
      const priceEl = $("#modalPrice");
      const descEl = $("#modalDesc");
      const sizesEl = $("#modalSizes");
      const colorsEl = $("#modalColors");
      const colorsSection = $("#qvColorsSection");
      const sizesSection = $("#qvSizesSection");
      const badgeEl = $("#modalBadge");
      const qtyEl = $("#qtyValue");
      const thumbsEl = $("#modalThumbs");
      const prevBtn = $("#galleryPrev");
      const nextBtn = $("#galleryNext");
      const wishlistBtn = $("#modalWishlist");

      // Parse images
      modalImages = [];
      if (product?.images) {
        if (Array.isArray(product.images)) {
          modalImages = product.images.filter(Boolean);
        } else if (typeof product.images === "string") {
          try {
            const parsed = JSON.parse(product.images);
            modalImages = Array.isArray(parsed)
              ? parsed.filter(Boolean)
              : [product.images];
          } catch {
            if (product.images.includes(",")) {
              modalImages = product.images
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            } else {
              modalImages = [product.images];
            }
          }
        }
      }
      if (!modalImages.length) modalImages = ["assets/img/placeholder.png"];

      // Set main image
      if (imgEl) {
        imgEl.src = modalImages[0];
        imgEl.alt = product?.name || "Product";
      }

      // Build thumbnails
      if (thumbsEl) {
        if (modalImages.length > 1) {
          thumbsEl.innerHTML = modalImages
            .map(
              (img, idx) => `
            <button type="button" class="gallery-thumb${idx === 0 ? " active" : ""}" data-index="${idx}">
              <img src="${img}" alt="Thumbnail ${idx + 1}">
            </button>
          `,
            )
            .join("");
          thumbsEl.hidden = false;
        } else {
          thumbsEl.innerHTML = "";
          thumbsEl.hidden = true;
        }
      }

      // Show/hide nav buttons
      if (prevBtn) prevBtn.hidden = modalImages.length <= 1;
      if (nextBtn) nextBtn.hidden = modalImages.length <= 1;

      // Populate text
      if (titleEl) titleEl.textContent = product?.name || "Product";
      if (priceEl)
        priceEl.textContent = UTILS.formatNaira(product?.price_ngn || 0);
      if (descEl) descEl.textContent = product?.description || "";
      if (qtyEl) qtyEl.textContent = "1";
      if (badgeEl) {
        badgeEl.hidden = !product?.is_new;
        badgeEl.textContent = "New";
      }

      // Colors
      const colors = product?.colors || [];
      const showColors = product?.allow_color_selection && colors.length > 0;
      if (colorsSection) colorsSection.hidden = !showColors;
      if (colorsEl && showColors) {
        colorsEl.innerHTML = colors
          .map((c, i) => {
            const colorName = typeof c === "string" ? c : c.name;
            const colorValue = getColorValue(colorName);
            const colorQty = typeof c === "object" ? c.qty || 1 : 1;
            const isInStock = colorQty > 0;
            return `<button class="qv-color${!isInStock ? " out-of-stock" : ""}" 
            data-color="${UTILS.safeText(colorName)}" 
            data-qty="${colorQty}" 
            title="${UTILS.safeText(colorName)}${!isInStock ? " (Out of Stock)" : ""}"
            style="background:${colorValue}" 
            ${!isInStock ? "disabled" : ""}></button>`;
          })
          .join("");
        modalSelectedColor = "";
      }

      // Sizes - normalizeSizes now returns array of {name, qty} objects
      const sizes = normalizeSizes(product);
      if (sizesSection) sizesSection.hidden = sizes.length === 0;
      if (sizesEl) {
        sizesEl.innerHTML = sizes
          .map((size) => {
            const label = UTILS.safeText(size.name);
            const sizeQty = size.qty || 0;
            const isInStock = sizeQty > 0;
            return `<button type="button" class="qv-size${!isInStock ? " out-of-stock" : ""}" 
            data-size="${label}" data-qty="${sizeQty}" ${!isInStock ? "disabled" : ""}>${label}</button>`;
          })
          .join("");

        if (sizes.length === 1) {
          modalSelectedSize = sizes[0].name;
          const firstBtn = sizesEl.querySelector(".qv-size");
          firstBtn?.classList.add("active");
        }
      }

      // Wishlist state
      if (wishlistBtn) {
        const wishlist = JSON.parse(
          localStorage.getItem("LBS_WISHLIST") || "[]",
        );
        const isWishlisted = wishlist.includes(String(product?.id));
        wishlistBtn.classList.toggle("is-active", isWishlisted);
        wishlistBtn.innerHTML = `<i class="${isWishlisted ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
      }

      // Show modal
      if (overlay) {
        overlay.classList.add("active");
      }
      if (modal) {
        modal.setAttribute("aria-hidden", "false");
      }
      document.body.style.overflow = "hidden";
      console.log("🔍 APP: Modal opened");
    };

    if (typeof productOrId === "object" && productOrId) {
      populate(productOrId);
      return;
    }

    const id = String(productOrId || "").trim();
    if (!id) return;

    fetchProductById(id).then((product) => {
      if (!product) {
        UTILS.toast("Product not found", "error");
        return;
      }
      populate(product);
    });
  }

  function closeModal() {
    console.log("❌ APP: closeModal()");
    const overlay = $("#quickViewOverlay");
    const modal = $("#variantModal") || $("#quickViewModal");

    if (overlay) {
      overlay.classList.remove("active");
    }
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    }

    // Also hide old backdrop if exists
    const backdrop = $("#modalBackdrop");
    if (backdrop) backdrop.classList.remove("active");

    document.body.style.overflow = "";
    modalProduct = null;
    modalSelectedSize = "";
    modalSelectedColor = "";
    modalQuantity = 1;
  }

  /* ─────────────────────────────────────────────
   * Theme Management - 3 Mode System (Light, Dark, System)
   * ───────────────────────────────────────────── */
  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(mode) {
    console.log(`🎨 APP: applyTheme() - mode: ${mode}`);
    let actualTheme;
    if (mode === "system") {
      actualTheme = getSystemTheme();
    } else {
      actualTheme = mode;
    }
    document.documentElement.setAttribute("data-theme", actualTheme);
  }

  function setTheme(mode) {
    console.log(`🎨 APP: setTheme() - ${mode}`);
    UTILS.saveJSON(THEME_KEY, mode);
    applyTheme(mode);
    updateThemeToggleUI(mode);
    updateMobileThemeToggleUI(mode);
  }

  function updateThemeToggleUI(mode) {
    console.log(`🎨 APP: updateThemeToggleUI() - ${mode}`);
    const toggleContainer = $("#themeToggle");
    if (!toggleContainer) return;

    const buttons = toggleContainer.querySelectorAll(".theme-btn");
    buttons.forEach((btn) => {
      const btnTheme = btn.getAttribute("data-theme");
      btn.classList.toggle("active", btnTheme === mode);
    });
  }

  function initTheme() {
    console.log("🎨 APP: initTheme()");
    const saved = UTILS.loadJSON(THEME_KEY, null);
    // Default to system preference if nothing saved
    const mode = saved || "system";
    applyTheme(mode);
    updateThemeToggleUI(mode);

    // Listen for system theme changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        const currentMode = UTILS.loadJSON(THEME_KEY, "system");
        if (currentMode === "system") {
          applyTheme("system");
        }
      });

    // Listen for clicks on theme toggle buttons
    const toggleContainer = $("#themeToggle");
    if (toggleContainer) {
      toggleContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".theme-btn");
        if (!btn) return;
        const newMode = btn.getAttribute("data-theme");
        if (newMode) {
          console.log(`🎨 APP: Theme button clicked - ${newMode}`);
          setTheme(newMode);
        }
      });
    }

    // Auto-update year in footer
    const yearEl = document.getElementById("currentYear");
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
      console.log(`📅 APP: Year set to ${yearEl.textContent}`);
    }
  }

  /* ─────────────────────────────────────────────
   * Mobile Navigation (New Drawer Design)
   * ───────────────────────────────────────────── */
  function openMobileNav() {
    console.log("📱 APP: openMobileNav()");
    const nav = $("#mobileNav");
    const toggle = $("#mobileToggle");
    if (!nav) return;

    nav.classList.add("active");
    toggle?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeMobileNav() {
    console.log("📱 APP: closeMobileNav()");
    const nav = $("#mobileNav");
    const toggle = $("#mobileToggle");
    if (!nav) return;

    nav.classList.remove("active");
    toggle?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function toggleMobileNav() {
    console.log("📱 APP: toggleMobileNav()");
    const nav = $("#mobileNav");
    if (nav?.classList.contains("active")) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  }

  /* ─────────────────────────────────────────────
   * Initialization
   * ───────────────────────────────────────────── */
  function initDrawer() {
    console.log("🎛️ APP: initDrawer()");
    // Open drawer buttons
    $$("[data-cart-drawer]").forEach((btn) => {
      btn.addEventListener("click", openDrawer);
    });

    // Modern cart drawer close button
    $("#closeCartDrawer")?.addEventListener("click", closeDrawer);

    // Legacy close button
    $("#drawerCloseBtn")?.addEventListener("click", closeDrawer);

    // Cart drawer overlay click to close
    const overlay = $("#cartDrawerOverlay");
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeDrawer();
    });

    // Continue shopping button
    $("#continueShoppingBtn")?.addEventListener("click", closeDrawer);

    // Checkout button — require login before proceeding
    const checkoutBtn = $(".cd-checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", (e) => {
        const client = window.DB?.client;
        if (!client) return; // Supabase not loaded, let link work normally

        e.preventDefault();
        client.auth.getSession().then(({ data }) => {
          if (data?.session?.user) {
            window.location.href = "checkout.html";
          } else {
            closeDrawer();
            UTILS.toast?.(
              "Please sign in or create an account to proceed to checkout. It only takes a moment!",
              "info",
            );
            setTimeout(() => {
              if (window.AUTH?.openModal) {
                window.AUTH.openModal("login");
              } else {
                document.getElementById("loginBtn")?.click();
              }
            }, 1200);
          }
        });
      });
    }

    // Modern cart drawer body - handle qty/remove actions
    const cartDrawerBody = $("#cartDrawerBody");
    cartDrawerBody?.addEventListener("click", (e) => {
      const minusBtn = e.target.closest(".cd-qty-minus");
      const plusBtn = e.target.closest(".cd-qty-plus");
      const removeBtn = e.target.closest(".cd-item-remove");

      if (minusBtn) {
        updateCartItemQty(parseInt(minusBtn.dataset.idx, 10), -1);
      } else if (plusBtn) {
        updateCartItemQty(parseInt(plusBtn.dataset.idx, 10), 1);
      } else if (removeBtn) {
        removeCartItemByIndex(parseInt(removeBtn.dataset.idx, 10));
      }
    });

    // Legacy drawer item actions
    $("[data-drawer-list]")?.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const action = target.dataset.action;
      const row = target.closest("[data-variant-id]");
      const variantId = row?.dataset.variantId;
      const idx = row?.dataset.idx;

      console.log(`🎛️ APP: Drawer action - ${action} on ${variantId || idx}`);

      if (idx !== undefined) {
        if (action === "inc") updateCartItemQty(parseInt(idx, 10), 1);
        if (action === "dec") updateCartItemQty(parseInt(idx, 10), -1);
        if (action === "remove") removeCartItemByIndex(parseInt(idx, 10));
      } else if (variantId) {
        if (action === "inc") changeQty(variantId, 1);
        if (action === "dec") changeQty(variantId, -1);
        if (action === "remove") removeFromCart(variantId);
      }
    });
  }

  function initModal() {
    console.log("🎛️ APP: initModal()");
    const overlay = $("#quickViewOverlay");
    const modal = $("#variantModal") || $("#quickViewModal");
    if (!overlay && !modal) {
      console.log("⚠️ APP: Modal not found for init");
      return;
    }

    // Close button
    $("#modalCloseBtn")?.addEventListener("click", closeModal);

    // Click overlay to close
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    // Legacy backdrop click
    $("#modalBackdrop")?.addEventListener("click", closeModal);

    // Gallery navigation - Previous
    $("#galleryPrev")?.addEventListener("click", () => {
      if (modalImages.length <= 1) return;
      const newIndex =
        currentImageIndex === 0
          ? modalImages.length - 1
          : currentImageIndex - 1;
      updateGalleryImage(newIndex);
    });

    // Gallery navigation - Next
    $("#galleryNext")?.addEventListener("click", () => {
      if (modalImages.length <= 1) return;
      const newIndex =
        currentImageIndex === modalImages.length - 1
          ? 0
          : currentImageIndex + 1;
      updateGalleryImage(newIndex);
    });

    // Thumbnail clicks
    $("#modalThumbs")?.addEventListener("click", (e) => {
      const thumb = e.target.closest(".gallery-thumb");
      if (!thumb) return;
      const index = parseInt(thumb.dataset.index, 10);
      if (!isNaN(index)) updateGalleryImage(index);
    });

    // Double-click main image to open lightbox preview
    $("#qvMainWrap")?.addEventListener("dblclick", () => {
      if (modalImages.length > 0) {
        openImagePreview(currentImageIndex);
      }
    });

    // Size selection — tap to select, tap again to unselect
    $("#modalSizes")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".qv-size, .size-btn");
      if (!btn || btn.disabled) return;

      const wasActive = btn.classList.contains("active");
      $$("#modalSizes .qv-size, #modalSizes .size-btn").forEach((el) =>
        el.classList.remove("active"),
      );

      if (wasActive) {
        modalSelectedSize = "";
      } else {
        btn.classList.add("active");
        modalSelectedSize = btn.dataset.size || "";
      }
    });

    // Color selection — tap to select, tap again to unselect
    $("#modalColors")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".qv-color");
      if (!btn || btn.disabled) return;

      const wasActive = btn.classList.contains("active");
      $$("#modalColors .qv-color").forEach((el) =>
        el.classList.remove("active"),
      );

      if (wasActive) {
        modalSelectedColor = "";
      } else {
        btn.classList.add("active");
        modalSelectedColor = btn.dataset.color || "";
      }
    });

    // Quantity controls
    $("#qtyDecrease")?.addEventListener("click", () => {
      if (modalQuantity > 1) {
        modalQuantity--;
        const el = $("#qtyValue");
        if (el) el.textContent = String(modalQuantity);
      }
    });

    $("#qtyIncrease")?.addEventListener("click", () => {
      if (modalQuantity < 99) {
        modalQuantity++;
        const el = $("#qtyValue");
        if (el) el.textContent = String(modalQuantity);
      }
    });

    // Wishlist button
    $("#modalWishlist")?.addEventListener("click", () => {
      if (!modalProduct) return;
      const wishlist = JSON.parse(localStorage.getItem("LBS_WISHLIST") || "[]");
      const id = String(modalProduct.id);
      const idx = wishlist.indexOf(id);

      if (idx > -1) {
        wishlist.splice(idx, 1);
        UTILS.toast("Removed from wishlist", "info");
      } else {
        wishlist.push(id);
        UTILS.toast("Added to wishlist", "success");
      }

      localStorage.setItem("LBS_WISHLIST", JSON.stringify(wishlist));
      const btn = $("#modalWishlist");
      if (btn) {
        btn.classList.toggle("is-active", idx === -1);
        btn.innerHTML = `<i class="${idx === -1 ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
      }
    });

    // Add to cart
    $("#modalAddToCart")?.addEventListener("click", () => {
      if (!modalProduct) return;

      const sizes = normalizeSizes(modalProduct);
      if (sizes.length > 1 && !modalSelectedSize) {
        UTILS.toast("Please select a size", "warning");
        return;
      }

      const colors = modalProduct.colors || [];
      if (
        modalProduct.allow_color_selection &&
        colors.length > 1 &&
        !modalSelectedColor
      ) {
        UTILS.toast("Please select a color", "warning");
        return;
      }

      const chosenSize =
        modalSelectedSize || sizes[0]?.name || sizes[0] || "One Size";
      const chosenColor = modalSelectedColor || "";
      const imageUrl = getFirstImage(modalProduct.images);

      addToCart({
        id: modalProduct.id,
        variantId: buildVariantId(modalProduct.id, chosenSize, chosenColor),
        name: modalProduct.name,
        price_ngn: Number(modalProduct.price_ngn || 0),
        image: imageUrl,
        selectedSize: chosenSize,
        selectedColor: chosenColor,
        qty: modalQuantity,
      });

      closeModal();
    });

    // Escape key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const overlay = $("#quickViewOverlay");
        if (overlay?.classList.contains("active")) {
          closeModal();
        }
      }
    });
  }

  function initMobileNav() {
    console.log("🎛️ APP: initMobileNav()");

    // Toggle button
    const toggle = $("#mobileToggle");
    toggle?.addEventListener("click", toggleMobileNav);

    // Close button in drawer
    const closeBtn = $("#mobileNavClose");
    closeBtn?.addEventListener("click", closeMobileNav);

    // Backdrop click to close
    const backdrop = $("#mobileNavBackdrop");
    backdrop?.addEventListener("click", closeMobileNav);

    // Mobile theme toggle (new drawer design with slider)
    // Direct handler for #themeSlider (most reliable)
    const themeSliderById = $("#themeSlider");
    if (themeSliderById) {
      themeSliderById.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentTheme =
          document.documentElement.getAttribute("data-theme") || "light";
        const newMode = currentTheme === "dark" ? "light" : "dark";
        console.log(
          `🎨 APP: Theme slider (#themeSlider) clicked - switching to ${newMode}`,
        );
        setTheme(newMode);
      });
      console.log("🎨 APP: Theme slider #themeSlider listener attached");
    }

    const mobileThemeToggle = $("#mobileThemeToggle");
    if (mobileThemeToggle) {
      // Handle click on drawer theme toggle (sun/moon slider)
      const drawerThemeToggle = mobileThemeToggle.querySelector(
        ".drawer-theme-toggle",
      );
      if (drawerThemeToggle && drawerThemeToggle !== themeSliderById) {
        drawerThemeToggle.addEventListener("click", (e) => {
          e.preventDefault();
          const currentTheme =
            document.documentElement.getAttribute("data-theme") || "light";
          const newMode = currentTheme === "dark" ? "light" : "dark";
          console.log(`🎨 APP: Drawer theme toggle clicked - ${newMode}`);
          setTheme(newMode);
        });
      }

      // Also support old slider class for backwards compatibility
      const themeSlider = mobileThemeToggle.querySelector(".theme-slider");
      if (themeSlider && themeSlider !== themeSliderById) {
        themeSlider.addEventListener("click", (e) => {
          e.preventDefault();
          const currentTheme =
            document.documentElement.getAttribute("data-theme") || "light";
          const newMode = currentTheme === "dark" ? "light" : "dark";
          console.log(`🎨 APP: Theme slider toggled - ${newMode}`);
          setTheme(newMode);
        });
      }

      // Initialize mobile theme toggle UI
      const saved = UTILS.loadJSON(THEME_KEY, null);
      const mode = saved || "system";
      updateMobileThemeToggleUI(mode);
    }

    // Close on resize (desktop breakpoint)
    window.addEventListener(
      "resize",
      UTILS.throttle(() => {
        if (window.innerWidth > 1024) {
          closeMobileNav();
        }
      }, 200),
    );
  }

  function updateMobileThemeToggleUI(mode) {
    const mobileToggle = $("#mobileThemeToggle");
    if (!mobileToggle) return;
    const buttons = mobileToggle.querySelectorAll(".theme-btn");
    buttons.forEach((btn) => {
      const btnTheme = btn.getAttribute("data-theme");
      btn.classList.toggle("active", btnTheme === mode);
    });
  }

  function initKeyboardNav() {
    console.log("⌨️ APP: initKeyboardNav()");
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        console.log("⌨️ APP: Escape pressed");
        closeDrawer();
        closeModal();
        closeMobileNav();
      }
    });
  }

  function initHeader() {
    console.log("📌 APP: initHeader()");
    const header = $("#siteHeader");
    if (!header) return;

    let lastScroll = 0;
    window.addEventListener(
      "scroll",
      UTILS.throttle(() => {
        const currentScroll = window.scrollY;

        if (currentScroll > 100) {
          header.classList.add("scrolled");
        } else {
          header.classList.remove("scrolled");
        }

        if (currentScroll > lastScroll && currentScroll > 200) {
          header.classList.add("hidden");
        } else {
          header.classList.remove("hidden");
        }

        lastScroll = currentScroll;
      }, 100),
    );
  }

  function initRealtime() {
    console.log("🔄 APP: initRealtime()");
    const client = getClient();
    if (!client) return;

    const hasProductsGrid =
      $("[data-home-products]") || $("[data-products-grid]");
    if (!hasProductsGrid) return;

    client
      .channel("lbs-products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          console.log("🔄 APP: Realtime products changed");
          emit("products:changed");
        },
      )
      .subscribe();
  }

  /* ─────────────────────────────────────────────
   * WhatsApp Live Chat Widget
   * Dynamically injected on all pages using config
   * Uses the floating style with gradient, pulse animation & tooltip
   * ───────────────────────────────────────────── */
  function initWhatsAppWidget() {
    console.log("💬 APP: initWhatsAppWidget()");

    // Don't show on admin page
    if (
      document.body.classList.contains("admin-body") ||
      document.body.classList.contains("admin-page")
    )
      return;

    // Remove any existing hardcoded widget (cleanup)
    document
      .querySelectorAll(".whatsapp-float, .whatsapp-widget")
      .forEach((el) => el.remove());

    const waLink =
      window.APP_CONFIG?.SOCIAL?.whatsapp || "https://wa.me/2349033344860";
    const number = waLink.replace(/\D/g, "");
    const message = encodeURIComponent("Hello! I'd like to make an enquiry.");
    const whatsappUrl = `https://wa.me/${number}?text=${message}`;

    // Create WhatsApp chat widget with popup
    const widget = document.createElement("div");
    widget.className = "whatsapp-float";
    widget.innerHTML = `
      <div class="wa-popup" id="waPopup">
        <div class="wa-popup-header">
          <div class="wa-popup-avatar">
            <i class="fa-brands fa-whatsapp"></i>
          </div>
          <div class="wa-popup-info">
            <span class="wa-popup-name">Lingerie by Sisioyin</span>
            <span class="wa-popup-status">Typically replies within minutes</span>
          </div>
          <button class="wa-popup-close" id="waPopupClose" aria-label="Close chat popup">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="wa-popup-body">
          <div class="wa-popup-msg">
            <p>Hi there! 👋</p>
            <p>How can we help you today? Tap below to start a conversation on WhatsApp.</p>
            <span class="wa-popup-time">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
        <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="wa-popup-cta">
          <i class="fa-brands fa-whatsapp"></i> Start Chat
        </a>
      </div>
      <button class="whatsapp-float-btn" id="waToggle" aria-label="Chat on WhatsApp" title="Chat with us on WhatsApp">
        <i class="fa-brands fa-whatsapp wa-icon-chat"></i>
        <i class="fa-solid fa-xmark wa-icon-close"></i>
      </button>
      <span class="whatsapp-tooltip">Chat with us!</span>
    `;

    document.body.appendChild(widget);

    // Show widget after 10 second delay
    setTimeout(() => {
      widget.classList.add("wa-visible");
    }, 10000);

    // Toggle popup
    const toggleBtn = widget.querySelector("#waToggle");
    const popup = widget.querySelector("#waPopup");
    const closeBtn = widget.querySelector("#waPopupClose");

    toggleBtn.addEventListener("click", () => {
      const isOpen = widget.classList.toggle("wa-open");
      toggleBtn.setAttribute("aria-expanded", isOpen);
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      widget.classList.remove("wa-open");
      toggleBtn.setAttribute("aria-expanded", "false");
    });

    // Close popup on outside click
    document.addEventListener("click", (e) => {
      if (!widget.contains(e.target) && widget.classList.contains("wa-open")) {
        widget.classList.remove("wa-open");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ─────────────────────────────────────────────
   * Scroll Reveal Animations
   * ───────────────────────────────────────────── */
  function initScrollReveal() {
    console.log("✨ APP: initScrollReveal()");

    // Elements that should animate on scroll
    const revealSelectors = [
      "[data-reveal]",
      ".scroll-reveal",
      ".scroll-fade-up",
      ".scroll-fade-left",
      ".scroll-fade-right",
      ".scroll-scale",
      ".scroll-stagger",
      ".feature-card",
      ".category-card",
      ".trust-item",
      ".category-new-card",
      ".section-header",
      ".products-section .products-grid",
      ".categories-new .categories-grid",
      ".trust-section .trust-grid",
      ".faq-item",
      ".newsletter-section",
    ];

    const revealElements = $$(revealSelectors.join(", "));

    if (!revealElements.length) {
      console.log("✨ APP: No reveal elements found");
      return;
    }

    console.log(`✨ APP: Found ${revealElements.length} elements to reveal`);

    // Use IntersectionObserver for better performance
    const observerOptions = {
      root: null,
      rootMargin: "0px 0px -80px 0px",
      threshold: 0.1,
    };

    const revealCallback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;

          // Add revealed class for CSS-based animations
          el.classList.add("revealed");

          // Also handle inline style animations for backwards compatibility
          if (el.style.opacity === "0") {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }

          // Stop observing once revealed
          observer.unobserve(el);
        }
      });
    };

    const observer = new IntersectionObserver(revealCallback, observerOptions);

    // Set initial state and observe
    revealElements.forEach((el, index) => {
      // Skip if element already has CSS animation class
      const hasCSSAnimation =
        el.classList.contains("scroll-reveal") ||
        el.classList.contains("scroll-fade-up") ||
        el.classList.contains("scroll-fade-left") ||
        el.classList.contains("scroll-fade-right") ||
        el.classList.contains("scroll-scale") ||
        el.classList.contains("scroll-stagger");

      if (!hasCSSAnimation) {
        // Apply inline styles for elements without CSS classes
        el.style.opacity = "0";
        el.style.transform = "translateY(30px)";
        el.style.transition = `opacity 0.6s ease ${(index % 6) * 0.08}s, transform 0.6s ease ${(index % 6) * 0.08}s`;
      }

      observer.observe(el);
    });

    // Fallback: Check on scroll for older browsers
    const fallbackReveal = () => {
      revealElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight - 80;

        if (isVisible && !el.classList.contains("revealed")) {
          el.classList.add("revealed");
          if (el.style.opacity === "0") {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }
        }
      });
    };

    // Initial check after a small delay
    setTimeout(fallbackReveal, 200);
  }

  /* ─────────────────────────────────────────────
   * Counter Animation for Stats
   * ───────────────────────────────────────────── */
  function initCounterAnimation() {
    console.log("🔢 APP: initCounterAnimation()");

    const counters = $$(".hero-stats-number, [data-counter]");

    counters.forEach((counter) => {
      const target = parseInt(counter.textContent.replace(/\D/g, ""), 10);
      if (isNaN(target)) return;

      const suffix = counter.textContent.replace(/[\d,]/g, "");
      let current = 0;
      const increment = target / 50;
      const duration = 2000;
      const stepTime = duration / 50;

      const updateCounter = () => {
        current += increment;
        if (current < target) {
          counter.textContent = Math.floor(current) + suffix;
          setTimeout(updateCounter, stepTime);
        } else {
          counter.textContent = target + suffix;
        }
      };

      // Start animation when element is in view
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              updateCounter();
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 },
      );

      observer.observe(counter);
    });
  }

  /* ─────────────────────────────────────────────
   * Global API
   * ───────────────────────────────────────────── */
  window.APP = {
    getCart,
    setCart,
    addToCart,
    removeFromCart,
    changeQty,
    clearCart,
    updateCartBadge,
    renderCartDrawer,
    openDrawer,
    closeDrawer,
    openModal,
    closeModal,
    openVariantModal: openModal, // Alias for compatibility
    closeVariantModal: closeModal,
    // Wishlist
    getWishlist,
    setWishlist,
    toggleWishlist,
    isInWishlist,
    // Recently Viewed
    addToRecentlyViewed,
    getRecentlyViewed,
  };

  /* ─────────────────────────────────────────────
   * Wishlist Event Delegation
   * ───────────────────────────────────────────── */
  function initWishlist() {
    console.log("❤️ APP: initWishlist()");
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='wishlist']");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const productId =
        btn.dataset.id || btn.closest("[data-product-id]")?.dataset.productId;
      if (!productId) return;

      const isAdded = toggleWishlist(productId);
      const icon = btn.querySelector("i");

      if (isAdded) {
        btn.classList.add("active");
        if (icon) {
          icon.classList.remove("fa-regular");
          icon.classList.add("fa-solid");
        }
      } else {
        btn.classList.remove("active");
        if (icon) {
          icon.classList.remove("fa-solid");
          icon.classList.add("fa-regular");
        }
      }
    });
  }

  /* ─────────────────────────────────────────────
   * Recently Viewed Products
   * ───────────────────────────────────────────── */
  const RECENTLY_VIEWED_KEY = "LBS_RECENTLY_VIEWED";
  const MAX_RECENTLY_VIEWED = 8;

  function getRecentlyViewed() {
    return UTILS.loadJSON(RECENTLY_VIEWED_KEY, []);
  }

  function addToRecentlyViewed(productId) {
    if (!productId) return;
    let items = getRecentlyViewed();
    items = items.filter((id) => id !== productId);
    items.unshift(productId);
    items = items.slice(0, MAX_RECENTLY_VIEWED);
    UTILS.saveJSON(RECENTLY_VIEWED_KEY, items);
  }

  /* ─────────────────────────────────────────────
   * Search Functionality
   * ───────────────────────────────────────────── */
  function initSearch() {
    const searchToggle = $("#searchToggle");
    const searchOverlay = $("#searchOverlay");
    const searchInput = $("#searchInput");
    const searchClose = $("#searchClose");
    const searchResults = $("#searchResults");

    if (!searchOverlay) return;

    let searchTimeout = null;

    function openSearch() {
      searchOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
      setTimeout(() => searchInput?.focus(), 100);
    }

    function closeSearch() {
      searchOverlay.classList.remove("active");
      document.body.style.overflow = "";
      if (searchInput) searchInput.value = "";
      if (searchResults) {
        searchResults.innerHTML = `
          <div class="search-empty">
            <i class="fa-solid fa-magnifying-glass"></i>
            <p>Start typing to search products...</p>
          </div>
        `;
      }
    }

    async function performSearch(query) {
      if (!query || query.length < 2) {
        searchResults.innerHTML = `
          <div class="search-empty">
            <i class="fa-solid fa-magnifying-glass"></i>
            <p>Start typing to search products...</p>
          </div>
        `;
        return;
      }

      const client = getClient();
      if (!client) return;

      searchResults.innerHTML = `
        <div class="search-empty">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <p>Searching...</p>
        </div>
      `;

      try {
        // First, try exact/partial match
        const { data, error } = await client
          .from("products")
          .select("id, name, price_ngn, images, category")
          .eq("is_active", true)
          .eq("is_deleted", false)
          .or(
            `name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`,
          )
          .limit(8);

        if (error) throw error;

        // If no results, fetch suggested products
        if (!data || data.length === 0) {
          const { data: suggestions } = await client
            .from("products")
            .select("id, name, price_ngn, images, category")
            .eq("is_active", true)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(6);

          searchResults.innerHTML = `
            <div class="search-no-match">
              <p>No exact matches for "<strong>${UTILS.safeText(query)}</strong>"</p>
            </div>
            <div class="search-suggestions-label">
              <i class="fa-solid fa-wand-magic-sparkles"></i> You might like
            </div>
            ${(suggestions || [])
              .map(
                (product) => `
              <a href="shop.html?product=${product.id}" class="search-result-item" data-product-id="${product.id}">
                <img src="${getFirstImage(product.images)}" alt="${UTILS.safeText(product.name)}" class="search-result-img" />
                <div class="search-result-info">
                  <div class="search-result-name">${UTILS.safeText(product.name)}</div>
                  <div class="search-result-price">${UTILS.formatNaira(product.price_ngn)}</div>
                </div>
              </a>
            `,
              )
              .join("")}
            <a href="shop.html" class="search-view-all">
              <i class="fa-solid fa-store"></i> Browse all products
            </a>
          `;
          return;
        }

        // Show results with "View all" link
        searchResults.innerHTML =
          data
            .map(
              (product) => `
          <a href="shop.html?product=${product.id}" class="search-result-item" data-product-id="${product.id}">
            <img src="${getFirstImage(product.images)}" alt="${UTILS.safeText(product.name)}" class="search-result-img" />
            <div class="search-result-info">
              <div class="search-result-name">${UTILS.safeText(product.name)}</div>
              <div class="search-result-price">${UTILS.formatNaira(product.price_ngn)}</div>
            </div>
          </a>
        `,
            )
            .join("") +
          `
          <a href="shop.html?search=${encodeURIComponent(query)}" class="search-view-all">
            <i class="fa-solid fa-arrow-right"></i> View all results for "${UTILS.safeText(query)}"
          </a>
        `;
      } catch (err) {
        console.error("Search error:", err);
        searchResults.innerHTML = `
          <div class="search-empty">
            <i class="fa-solid fa-exclamation-circle"></i>
            <p>Error searching. Please try again.</p>
          </div>
        `;
      }
    }

    if (searchToggle) {
      searchToggle.addEventListener("click", openSearch);
    }

    if (searchClose) {
      searchClose.addEventListener("click", closeSearch);
    }

    if (searchOverlay) {
      searchOverlay.addEventListener("click", (e) => {
        if (e.target === searchOverlay) closeSearch();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          performSearch(e.target.value.trim());
        }, 300);
      });
    }

    // Keyboard shortcut: Ctrl+K or Cmd+K
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (searchOverlay.classList.contains("active")) {
          closeSearch();
        } else {
          openSearch();
        }
      }
      if (e.key === "Escape" && searchOverlay.classList.contains("active")) {
        closeSearch();
      }
    });

    console.log("🔍 APP: Search initialized");
  }

  /* ─────────────────────────────────────────────
   * Size Guide Modal
   * ───────────────────────────────────────────── */
  function initSizeGuide() {
    const modal = $("#sizeGuideModal");
    const openBtn = $("#openSizeGuide");
    const closeBtn = $("#closeSizeGuide");

    if (!modal) return;

    function openSizeGuide() {
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
    }

    function closeSizeGuide() {
      modal.style.display = "none";
      document.body.style.overflow = "";
    }

    if (openBtn) {
      openBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openSizeGuide();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", closeSizeGuide);
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeSizeGuide();
    });

    // Also handle data-open-size-guide attribute
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-open-size-guide]")) {
        e.preventDefault();
        openSizeGuide();
      }
    });

    // Size Guide Tab Switching
    const tabs = modal.querySelectorAll(".size-guide-tab");
    const panels = modal.querySelectorAll(".size-guide-panel");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetPanel = tab.dataset.tab;

        // Update tabs
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Update panels
        panels.forEach((p) => {
          p.classList.toggle("active", p.dataset.panel === targetPanel);
        });
      });
    });

    console.log("📏 APP: Size guide initialized");
  }

  /* ─────────────────────────────────────────────
   * Newsletter Form
   * ───────────────────────────────────────────── */
  function initNewsletter() {
    const form = $("#newsletterForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const input = form.querySelector("input[type='email']");
      const btn = form.querySelector("button");
      const email = input?.value?.trim();

      if (!email) return;

      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

      // Save to Supabase if client available
      const client = getClient();
      if (client) {
        try {
          await client.from("newsletter_subscribers").insert({ email });
        } catch (err) {
          console.log("Newsletter save error (table may not exist):", err);
        }
      }

      // Show success
      UTILS.showToast?.("Thank you for subscribing! 🎉", "success");
      input.value = "";
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    });

    console.log("📧 APP: Newsletter initialized");
  }

  /* ─────────────────────────────────────────────
   * Social Sharing
   * ───────────────────────────────────────────── */
  window.shareProduct = function (platform, productName, productUrl) {
    const text = `Check out ${productName} from Lingerie by Sisioyin!`;
    const url = productUrl || window.location.href;

    let shareUrl = "";

    switch (platform) {
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
        break;
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case "twitter":
      case "x":
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case "instagram":
        // Instagram doesn't have direct share URL, copy link and show message
        navigator.clipboard.writeText(url).then(() => {
          UTILS.showToast?.(
            "Link copied! Paste it in your Instagram story or bio.",
            "info",
          );
        });
        return;
      case "tiktok":
        // TikTok doesn't have direct share URL, copy link and show message
        navigator.clipboard.writeText(url).then(() => {
          UTILS.showToast?.("Link copied! Share it on TikTok.", "info");
        });
        return;
      case "copy":
        navigator.clipboard.writeText(url).then(() => {
          UTILS.showToast?.("Link copied to clipboard!", "success");
        });
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=400");
    }
  };

  /* ─────────────────────────────────────────────
   * Promo Codes
   * ───────────────────────────────────────────── */
  const PROMO_KEY = "LBS_PROMO";

  window.applyPromoCode = async function (code) {
    if (!code) return { valid: false, message: "Please enter a promo code" };

    const client = getClient();
    if (!client) return { valid: false, message: "Unable to verify code" };

    try {
      const { data, error } = await client
        .from("promo_codes")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        return { valid: false, message: "Invalid promo code" };
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return { valid: false, message: "This promo code has expired" };
      }

      // Check usage limit
      if (data.max_uses && data.used_count >= data.max_uses) {
        return {
          valid: false,
          message: "This promo code has reached its limit",
        };
      }

      // Save applied promo
      UTILS.saveJSON(PROMO_KEY, data);
      emit("promo:applied", data);

      return {
        valid: true,
        message: `${data.discount_percent}% discount applied!`,
        discount: data.discount_percent,
      };
    } catch (err) {
      console.error("Promo code error:", err);
      return { valid: false, message: "Error verifying code" };
    }
  };

  window.getAppliedPromo = function () {
    return UTILS.loadJSON(PROMO_KEY, null);
  };

  window.removePromo = function () {
    localStorage.removeItem(PROMO_KEY);
    emit("promo:removed");
  };

  /* ─────────────────────────────────────────────
   * Service Worker Registration (PWA)
   * ───────────────────────────────────────────── */
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        // Get the base path dynamically
        const basePath = window.location.pathname.substring(
          0,
          window.location.pathname.lastIndexOf("/") + 1,
        );
        const swPath = basePath + "sw.js";

        navigator.serviceWorker
          .register(swPath)
          .then((registration) => {
            console.log("📦 SW: Registered, scope:", registration.scope);
          })
          .catch((error) => {
            console.log("📦 SW: Registration failed:", error);
          });
      });
    }
  }

  /* ─────────────────────────────────────────────
   * Navigation Active State
   * ───────────────────────────────────────────── */
  function initNavActiveState() {
    console.log("🔗 APP: initNavActiveState()");
    const currentPage =
      window.location.pathname.split("/").pop() || "index.html";
    const currentSearch = window.location.search;

    // Remove all existing active classes
    $$(".nav-link.active").forEach((el) => el.classList.remove("active"));
    $$(".mobile-nav-tile.active").forEach((el) =>
      el.classList.remove("active"),
    );

    // Set active state for desktop nav
    $$(".nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      if (href === currentPage || href === currentPage + currentSearch) {
        link.classList.add("active");
      } else if (currentPage === "index.html" && href === "index.html") {
        link.classList.add("active");
      } else if (
        currentPage.startsWith("shop") &&
        href === "shop.html" &&
        !currentSearch
      ) {
        link.classList.add("active");
      }
    });

    // Set active state for mobile nav tiles
    $$(".mobile-nav-tile").forEach((tile) => {
      const href = tile.getAttribute("href");
      if (href === currentPage) {
        tile.classList.add("active");
      }
    });
  }

  /* ─────────────────────────────────────────────
   * Update Social & WhatsApp Links from Config
   * Reads SOCIAL object in config.js and patches all
   * footer-social links, contact social links, WhatsApp
   * buttons, and phone hrefs so you only edit config.js.
   * ───────────────────────────────────────────── */
  function updateSocialLinks() {
    const social = window.APP_CONFIG?.SOCIAL || {};

    // ── WhatsApp: update every wa.me link, preserve ?text= param ──
    if (social.whatsapp) {
      // Extract raw number from "https://wa.me/2349033344860"
      const number = social.whatsapp.replace(/\D/g, "");
      document.querySelectorAll('a[href*="wa.me/"]').forEach((link) => {
        try {
          const url = new URL(link.href);
          const text = url.searchParams.get("text");
          link.href = `https://wa.me/${number}${text ? "?text=" + encodeURIComponent(text) : ""}`;
        } catch (_) {
          link.href = social.whatsapp;
        }
      });
      // Update tel: links (contact page phone number)
      document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
        link.href = `tel:+${number}`;
        // Update visible text if it looks like a phone number
        if (/^\+?[\d\s()-]+$/.test(link.textContent.trim())) {
          link.textContent = `+${number.replace(/(\d{3})(\d{3})(\d{3})(\d{4})/, "$1 $2 $3 $4")}`;
        }
      });
    }

    // ── Instagram: update footer + contact social links ──
    if (social.instagram) {
      document.querySelectorAll('a[aria-label="Instagram"]').forEach((link) => {
        link.href = social.instagram;
      });
    }

    // ── TikTok: update footer + contact social links ──
    if (social.tiktok) {
      document.querySelectorAll('a[aria-label="TikTok"]').forEach((link) => {
        link.href = social.tiktok;
      });
    }

    // ── Facebook (if added later) ──
    if (social.facebook) {
      document.querySelectorAll('a[aria-label="Facebook"]').forEach((link) => {
        link.href = social.facebook;
      });
    }

    console.log("✅ APP: Social links updated from config");
  }

  /* ─────────────────────────────────────────────
   * Bootstrap
   * ───────────────────────────────────────────── */
  console.log("🚀 APP: Bootstrap started");
  initTheme();
  initHeader();
  initMobileNav();
  initNavActiveState();
  initDrawer();
  initModal();
  initKeyboardNav();
  initWhatsAppWidget();
  updateSocialLinks();
  initScrollReveal();
  initCounterAnimation();
  initWishlist();
  initSearch();
  initSizeGuide();
  initNewsletter();
  updateCartBadge();
  renderCartDrawer();
  initRealtime();
  registerServiceWorker();
  console.log("✅ APP: Bootstrap complete");
})();
