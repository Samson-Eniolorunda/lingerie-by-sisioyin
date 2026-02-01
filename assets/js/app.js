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

  function buildVariantId(productId, size) {
    return `${productId}-${String(size || "One Size").trim()}`;
  }

  function normalizeSizes(product) {
    const raw = Array.isArray(product?.sizes)
      ? product.sizes
      : UTILS.parseCSV(product?.sizes);
    const clean = raw.map((s) => String(s).trim()).filter(Boolean);
    return clean.length ? clean : ["One Size"];
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
   * Cart Drawer
   * ───────────────────────────────────────────── */
  function openDrawer() {
    console.log("📂 APP: openDrawer()");
    const drawer = $("#cartDrawer");
    const overlay = $("#pageOverlay");
    if (!drawer) return;

    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    overlay?.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    console.log("📁 APP: closeDrawer()");
    const drawer = $("#cartDrawer");
    const overlay = $("#pageOverlay");
    if (!drawer) return;

    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    overlay?.classList.remove("active");
    document.body.style.overflow = "";
  }

  function renderCartDrawer() {
    console.log("🎨 APP: renderCartDrawer()");
    const list = $("[data-drawer-list]");
    const subtotalEl = $("[data-drawer-subtotal]");
    if (!list) return;

    const cart = getCart();
    let subtotal = 0;

    if (!cart.length) {
      list.innerHTML = `
        <div class="drawer-empty">
          <i class="fa-solid fa-bag-shopping"></i>
          <p>Your cart is empty</p>
          <a href="shop.html" class="btn btn-primary btn-sm">Start Shopping</a>
        </div>
      `;
      if (subtotalEl) subtotalEl.textContent = UTILS.formatNaira(0);
      return;
    }

    list.innerHTML = cart
      .map((item) => {
        const qty = Number(item.qty || 1);
        const price = Number(item.price_ngn || 0);
        const lineTotal = price * qty;
        subtotal += lineTotal;

        return `
        <div class="drawer-item" data-variant-id="${UTILS.safeText(item.variantId)}">
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

    if (subtotalEl) subtotalEl.textContent = UTILS.formatNaira(subtotal);
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

  function openModal(productOrId) {
    console.log("🔍 APP: openModal()", productOrId);
    const modal = $("#variantModal");
    if (!modal) return;

    const populate = (product) => {
      console.log("🔍 APP: Populating modal with:", product?.name);
      modalProduct = product;
      modalSelectedSize = "";
      modalQuantity = 1;
      currentImageIndex = 0;

      const imgEl = $("#modalImg");
      const titleEl = $("#modalTitle");
      const priceEl = $("#modalPrice");
      const descEl = $("#modalDesc");
      const sizesEl = $("#modalSizes");
      const badgeEl = $("#modalBadge");
      const qtyEl = $("#qtyValue");
      const thumbsEl = $("#modalThumbs");
      const prevBtn = $("#galleryPrev");
      const nextBtn = $("#galleryNext");

      // Parse images array - handle different formats
      modalImages = [];
      console.log(
        "🖼️ APP: Raw product images:",
        product?.images,
        typeof product?.images,
      );

      if (product?.images) {
        if (Array.isArray(product.images)) {
          modalImages = product.images.filter(Boolean);
        } else if (typeof product.images === "string") {
          // Try JSON parse first
          try {
            const parsed = JSON.parse(product.images);
            modalImages = Array.isArray(parsed)
              ? parsed.filter(Boolean)
              : [product.images];
          } catch {
            // Try comma-separated
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

      console.log(
        "🖼️ APP: Parsed modalImages:",
        modalImages.length,
        modalImages,
      );

      if (!modalImages.length) {
        modalImages = ["assets/img/placeholder.png"];
      }

      const imageUrl = modalImages[0];

      if (imgEl) {
        imgEl.src = imageUrl;
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

      if (titleEl) titleEl.textContent = product?.name || "Product";
      if (priceEl)
        priceEl.textContent = UTILS.formatNaira(product?.price_ngn || 0);
      if (descEl) descEl.textContent = product?.description || "";
      if (qtyEl) qtyEl.textContent = "1";

      if (badgeEl) {
        badgeEl.hidden = !product?.is_new;
        badgeEl.textContent = "New";
      }

      const sizes = normalizeSizes(product);
      if (sizesEl) {
        sizesEl.innerHTML = sizes
          .map((size) => {
            const label = UTILS.safeText(size);
            return `<button type="button" class="size-btn size-option" data-size="${label}">${label}</button>`;
          })
          .join("");

        if (sizes.length === 1) {
          modalSelectedSize = sizes[0];
          const firstBtn = sizesEl.querySelector(".size-btn");
          firstBtn?.classList.add("active");
        }
      }

      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
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
    const modal = $("#variantModal");
    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    modalProduct = null;
    modalSelectedSize = "";
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
   * Mobile Navigation
   * ───────────────────────────────────────────── */
  function openMobileNav() {
    console.log("📱 APP: openMobileNav()");
    const nav = $("#mobileNav");
    const overlay = $("#pageOverlay");
    const toggle = $("#mobileToggle");
    if (!nav) return;

    nav.classList.add("open");
    overlay?.classList.add("active");
    toggle?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeMobileNav() {
    console.log("📱 APP: closeMobileNav()");
    const nav = $("#mobileNav");
    const overlay = $("#pageOverlay");
    const toggle = $("#mobileToggle");
    if (!nav) return;

    nav.classList.remove("open");
    overlay?.classList.remove("active");
    toggle?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function toggleMobileNav() {
    console.log("📱 APP: toggleMobileNav()");
    const nav = $("#mobileNav");
    if (nav?.classList.contains("open")) {
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

    // Close drawer
    $("#drawerCloseBtn")?.addEventListener("click", closeDrawer);

    // Drawer item actions
    $("[data-drawer-list]")?.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const action = target.dataset.action;
      const row = target.closest("[data-variant-id]");
      const variantId = row?.dataset.variantId;
      if (!variantId) return;

      console.log(`🎛️ APP: Drawer action - ${action} on ${variantId}`);

      if (action === "inc") changeQty(variantId, 1);
      if (action === "dec") changeQty(variantId, -1);
      if (action === "remove") removeFromCart(variantId);
    });
  }

  function initModal() {
    console.log("🎛️ APP: initModal()");
    const modal = $("#variantModal");
    if (!modal) return;

    // Close buttons
    $("#modalClose")?.addEventListener("click", closeModal);
    $("#modalCloseBtn")?.addEventListener("click", closeModal);

    // Click outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

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

    // Size selection
    $("#modalSizes")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".size-btn");
      if (!btn) return;

      $$("#modalSizes .size-btn").forEach((el) =>
        el.classList.remove("active"),
      );
      btn.classList.add("active");
      modalSelectedSize = btn.dataset.size || "";
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

    // Legacy quantity controls (fallback)
    $("#qtyMinus")?.addEventListener("click", () => {
      if (modalQuantity > 1) {
        modalQuantity--;
        const el = $("#qtyValue");
        if (el) el.textContent = String(modalQuantity);
      }
    });

    $("#qtyPlus")?.addEventListener("click", () => {
      if (modalQuantity < 99) {
        modalQuantity++;
        const el = $("#qtyValue");
        if (el) el.textContent = String(modalQuantity);
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

      const chosenSize = modalSelectedSize || sizes[0] || "One Size";
      const imageUrl = getFirstImage(modalProduct.images);

      addToCart({
        id: modalProduct.id,
        variantId: buildVariantId(modalProduct.id, chosenSize),
        name: modalProduct.name,
        price_ngn: Number(modalProduct.price_ngn || 0),
        image: imageUrl,
        selectedSize: chosenSize,
        qty: modalQuantity,
      });

      closeModal();
    });
  }

  function initMobileNav() {
    console.log("🎛️ APP: initMobileNav()");
    const toggle = $("#mobileToggle");
    toggle?.addEventListener("click", toggleMobileNav);

    // Close on outside click
    $("#pageOverlay")?.addEventListener("click", () => {
      console.log("📱 APP: Page overlay clicked");
      closeDrawer();
      closeMobileNav();
      closeModal();
    });

    // Close on resize
    window.addEventListener(
      "resize",
      UTILS.throttle(() => {
        if (window.innerWidth > 1024) {
          closeMobileNav();
        }
      }, 200),
    );
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
   * ───────────────────────────────────────────── */
  function initWhatsAppWidget() {
    console.log("💬 APP: initWhatsAppWidget()");
    const widget = $("#whatsappWidget");
    const fab = $("#whatsappFab");
    const closeBtn = $("#whatsappClose");

    if (!widget || !fab) return;

    // Toggle popup on fab click
    fab.addEventListener("click", () => {
      console.log("💬 APP: WhatsApp FAB clicked");
      widget.classList.toggle("show-popup");
    });

    // Close popup
    closeBtn?.addEventListener("click", () => {
      console.log("💬 APP: WhatsApp popup closed");
      widget.classList.remove("show-popup");
    });

    // Auto-show popup after 10 seconds (first visit only)
    const hasSeenPopup = sessionStorage.getItem("LBS_WHATSAPP_POPUP_SHOWN");
    if (!hasSeenPopup) {
      setTimeout(() => {
        console.log("💬 APP: Auto-showing WhatsApp popup after 10 seconds");
        widget.classList.add("show-popup");
        sessionStorage.setItem("LBS_WHATSAPP_POPUP_SHOWN", "true");
      }, 10000);
    }
  }

  /* ─────────────────────────────────────────────
   * Scroll Reveal Animations
   * ───────────────────────────────────────────── */
  function initScrollReveal() {
    console.log("✨ APP: initScrollReveal()");

    const revealElements = $$(
      "[data-reveal], .feature-card, .category-card, .product-card, .section-header",
    );

    if (!revealElements.length) return;

    // Add initial hidden state
    revealElements.forEach((el, index) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(30px)";
      el.style.transition = `opacity 0.6s ease ${(index % 4) * 0.1}s, transform 0.6s ease ${(index % 4) * 0.1}s`;
    });

    const revealOnScroll = () => {
      revealElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight - 100;

        if (isVisible && el.style.opacity === "0") {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }
      });
    };

    // Initial check
    setTimeout(revealOnScroll, 100);

    // On scroll
    window.addEventListener("scroll", revealOnScroll, { passive: true });
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
        const { data, error } = await client
          .from("products")
          .select("id, name, price_ngn, images, category")
          .eq("is_active", true)
          .or(
            `name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`,
          )
          .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
          searchResults.innerHTML = `
            <div class="search-empty">
              <i class="fa-solid fa-face-sad-tear"></i>
              <p>No products found for "${UTILS.safeText(query)}"</p>
            </div>
          `;
          return;
        }

        searchResults.innerHTML = data
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
          .join("");
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
        navigator.serviceWorker
          .register("/sw.js")
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
   * Bootstrap
   * ───────────────────────────────────────────── */
  console.log("🚀 APP: Bootstrap started");
  initTheme();
  initHeader();
  initMobileNav();
  initDrawer();
  initModal();
  initKeyboardNav();
  initWhatsAppWidget();
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
