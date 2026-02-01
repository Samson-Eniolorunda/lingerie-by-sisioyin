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

  function createWishlistCard(product) {
    const img = getFirstImage(product.images);
    const name = UTILS.safeText(product.name);
    const price = UTILS.formatNaira(product.price_ngn);
    const category = UTILS.safeText(product.category);

    return `
      <article class="product-card" data-product-id="${product.id}">
        <div class="product-image">
          <img src="${img}" alt="${name}" loading="lazy" />
          <div class="product-overlay">
            <div class="product-overlay-buttons">
              <button type="button" class="overlay-btn quick-view-btn" data-id="${product.id}" aria-label="Quick view">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button type="button" class="overlay-btn wishlist-btn active" data-action="remove-wishlist" data-id="${product.id}" aria-label="Remove from wishlist">
                <i class="fa-solid fa-heart-crack"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="product-info">
          ${category ? `<span class="product-category">${category}</span>` : ""}
          <h3 class="product-name">${name}</h3>
          <div class="product-meta">
            <span class="product-price">${price}</span>
          </div>
          <button type="button" class="product-add-btn" data-action="quick-add" data-id="${product.id}">
            <i class="fa-solid fa-bag-shopping"></i>
            <span>Add to Cart</span>
          </button>
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
    } catch (err) {
      console.error("❌ WISHLIST: Exception:", err);
    }
  }

  function initEventListeners() {
    console.log("❤️ WISHLIST: Initializing event listeners...");

    // Remove from wishlist
    wishlistGrid?.addEventListener("click", async (e) => {
      const removeBtn = e.target.closest("[data-action='remove-wishlist']");
      if (removeBtn) {
        e.preventDefault();
        const productId = removeBtn.dataset.id;
        if (productId && removeFromWishlist(productId)) {
          // Remove card from DOM
          const card = removeBtn.closest(".product-card");
          card?.remove();

          // Check if wishlist is now empty
          if (!wishlistGrid.children.length) {
            wishlistEmpty.hidden = false;
            wishlistGrid.hidden = true;
          }
        }
        return;
      }

      // Quick view
      const quickViewBtn = e.target.closest(".quick-view-btn");
      if (quickViewBtn) {
        e.preventDefault();
        const productId = quickViewBtn.dataset.id;
        if (productId && window.APP?.openModal) {
          window.APP.openModal(productId);
        }
        return;
      }

      // Quick add to cart
      const addBtn = e.target.closest("[data-action='quick-add']");
      if (addBtn) {
        e.preventDefault();
        const productId = addBtn.dataset.id;
        if (productId && window.APP?.openModal) {
          window.APP.openModal(productId);
        }
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
