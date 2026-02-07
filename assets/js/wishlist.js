/**
 * Lingerie by Sisioyin - Wishlist Page
 * Displays saved/liked products
 */

(function () {
  "use strict";

  console.log("❤️ WISHLIST: Initializing wishlist page...");

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

  const WISHLIST_KEY = "LBS_WISHLIST";

  const wishlistGrid = $("#wishlistGrid");
  const wishlistEmpty = $("#wishlistEmpty");

  function getWishlist() {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
  }

  function removeFromWishlist(productId) {
    const wishlist = getWishlist();
    const index = wishlist.indexOf(String(productId));
    if (index > -1) {
      wishlist.splice(index, 1);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
      UTILS.toast("Removed from wishlist", "info");
      return true;
    }
    return false;
  }

  function getFirstImage(images) {
    if (Array.isArray(images) && images.length) return images[0];
    if (typeof images === "string" && images.trim())
      return images.split(",")[0].trim();
    return "https://placehold.co/400x500/f8fafc/be185d?text=No+Image";
  }

  // Check if product is new (within 14 days or marked as new in DB)
  function isNewProduct(createdAt, isNewFlag) {
    if (isNewFlag === true) return true;
    if (!createdAt) return false;
    const created = new Date(createdAt);
    const now = new Date();
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  }

  function createWishlistCard(product) {
    const imgRaw = getFirstImage(product.images);
    const img = UTILS.optimizedImg ? UTILS.optimizedImg(imgRaw, 400, 75) : imgRaw;
    const name = UTILS.safeText(product.name);
    const price = UTILS.formatNaira(product.price_ngn);
    const category = UTILS.safeText(product.category);
    const description = UTILS.safeText(product.description || "").slice(0, 60);
    const inStock = (product.qty || 0) > 0;
    const deliveryType = product.delivery_type || "standard";
    const isExpress = deliveryType === "express";
    const deliveryLabel = isExpress ? "Same-day" : "Standard";
    const reviewCount = product.review_count || 0;
    const isNew = isNewProduct(product.created_at, product.is_new);

    return `
      <article class="product-card" data-product-id="${product.id}">
        <div class="card-image">
          <img src="${img}" alt="${name}" loading="lazy" />
          ${isNew ? '<span class="card-new-badge">New</span>' : ""}
          <button type="button" class="card-wishlist active" data-action="remove-wishlist" data-id="${product.id}" data-tooltip="Remove from Wishlist" aria-label="Remove from Wishlist">
            <i class="fa-solid fa-heart-crack"></i>
          </button>
          ${!inStock ? '<div class="card-sold-out">Sold Out</div>' : ""}
        </div>
        <div class="card-info">
          <div class="card-top-row">
            <span class="card-category">${category}</span>
            <span class="card-delivery ${isExpress ? "express" : ""}"><i class="fa-solid ${isExpress ? "fa-bolt" : "fa-truck"}"></i> ${deliveryLabel}</span>
          </div>
          <h3 class="card-name">${name}</h3>
          ${description ? `<p class="card-description">${description}...</p>` : ""}
          <div class="card-review">${reviewCount > 0 ? `<i class="fa-solid fa-star"></i> ${reviewCount} reviews` : '<i class="fa-regular fa-star"></i> No reviews yet'}</div>
          <div class="card-bottom">
            <span class="card-price">${price}</span>
            <button type="button" class="card-cart-btn" data-action="quick-add" data-id="${product.id}" ${!inStock ? "disabled" : ""}>
              <i class="fa-solid fa-bag-shopping"></i> Add to Cart
            </button>
          </div>
        </div>
      </article>
    `;
  }

  async function loadWishlistProducts() {
    console.log("❤️ WISHLIST: Loading wishlist products...");
    const wishlist = getWishlist();

    if (!wishlist.length) {
      console.log("❤️ WISHLIST: Wishlist is empty");
      if (wishlistEmpty) wishlistEmpty.hidden = false;
      if (wishlistGrid) wishlistGrid.hidden = true;
      return;
    }

    const client = window.DB?.client;
    if (!client) {
      console.error("❌ WISHLIST: Database client not available");
      return;
    }

    try {
      const { data: products, error } = await client
        .from("products")
        .select("*")
        .in("id", wishlist);

      if (error) {
        console.error("❌ WISHLIST: Error fetching products:", error);
        return;
      }

      if (!products?.length) {
        console.log("❤️ WISHLIST: No products found");
        if (wishlistEmpty) wishlistEmpty.hidden = false;
        if (wishlistGrid) wishlistGrid.hidden = true;
        return;
      }

      console.log(`❤️ WISHLIST: Loaded ${products.length} products`);
      if (wishlistEmpty) wishlistEmpty.hidden = true;
      if (wishlistGrid) {
        wishlistGrid.hidden = false;
        wishlistGrid.innerHTML = products.map(createWishlistCard).join("");
      }
      // Update wishlist count display
      const countEl = document.getElementById("wishlistTotal");
      if (countEl) countEl.textContent = String(products.length);
      // Update header display
      const headerEl = document.getElementById("wishlistHeader");
      if (headerEl) headerEl.hidden = false;
    } catch (err) {
      console.error("❌ WISHLIST: Exception:", err);
    }
  }

  function initEventListeners() {
    console.log("❤️ WISHLIST: Initializing event listeners...");

    // Wishlist grid actions
    wishlistGrid?.addEventListener("click", async (e) => {
      // Remove from wishlist
      const removeBtn = e.target.closest("[data-action='remove-wishlist']");
      if (removeBtn) {
        e.preventDefault();
        const productId = removeBtn.dataset.id;
        if (productId && removeFromWishlist(productId)) {
          // Animate card removal
          const card = removeBtn.closest(".product-card");
          if (card) {
            card.style.transition = "all 0.3s ease";
            card.style.opacity = "0";
            card.style.transform = "scale(0.8)";
            setTimeout(() => {
              card.remove();
              // Update wishlist count display
              const countEl = document.getElementById("wishlistTotal");
              if (countEl) countEl.textContent = String(getWishlist().length);
              // Check if wishlist is now empty
              if (!wishlistGrid.children.length) {
                wishlistEmpty.hidden = false;
                wishlistGrid.hidden = true;
              }
            }, 300);
          }
        }
        return;
      }

      // Quick add to cart - open modal to select size/color
      const addBtn = e.target.closest("[data-action='quick-add']");
      if (addBtn) {
        e.preventDefault();
        const productId = addBtn.dataset.id;
        if (productId && window.APP?.openModal) {
          window.APP.openModal(productId);
        }
        return;
      }

      // Card click opens quick view
      const card = e.target.closest(".product-card");
      if (card && !e.target.closest("button")) {
        e.preventDefault();
        const productId = card.dataset.productId;
        if (productId && window.APP?.openModal) {
          window.APP.openModal(productId);
        }
      }
    });
      }
    });
  }

  // Initialize when DOM and database are ready
  function init() {
    console.log("❤️ WISHLIST: Checking for database...");
    if (window.DB?.client) {
      loadWishlistProducts();
      initEventListeners();
    } else {
      // Wait for database to be ready
      window.addEventListener("db:ready", () => {
        loadWishlistProducts();
        initEventListeners();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  console.log("✅ WISHLIST: Page initialized");
})();
