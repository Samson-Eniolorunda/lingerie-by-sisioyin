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

  function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    let stars = "";
    for (let i = 0; i < fullStars; i++) {
      stars += '<i class="fa-solid fa-star"></i>';
    }
    if (hasHalf) {
      stars += '<i class="fa-solid fa-star-half-stroke"></i>';
    }
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars += '<i class="fa-regular fa-star"></i>';
    }
    return stars;
  }

  function createWishlistCard(product) {
    const imgRaw = getFirstImage(product.images);
    const img = UTILS.optimizedImg
      ? UTILS.optimizedImg(imgRaw, 400, 75)
      : imgRaw;
    const name = UTILS.safeText(product.name);
    const price = UTILS.formatNaira(product.price_ngn);
    const category = UTILS.safeText(product.category);
    const isNew = isNewProduct(product.created_at, product.is_new);
    const rating = product.avg_rating || 0;
    const reviewCount = product.review_count || 0;
    const hasReviews = reviewCount > 0;

    return `
      <article class="arrival-card" data-product-id="${product.id}">
        <div class="arrival-card__visual">
          <img class="arrival-card__image" src="${img}" alt="${name}" loading="lazy" />
          ${isNew ? '<span class="arrival-card__badge">New</span>' : ""}
          <button type="button" class="arrival-card__wishlist is-active" data-action="remove-wishlist" data-id="${product.id}" aria-label="Remove from wishlist">
            <i class="fa-solid fa-heart-crack"></i>
          </button>
          <div class="arrival-card__actions">
            <button type="button" class="arrival-card__action-btn arrival-card__action-btn--primary" data-action="quick-view" aria-label="Quick view">
              <i class="fa-solid fa-eye"></i>
              <span>Quick View</span>
            </button>
          </div>
        </div>
        <div class="arrival-card__content">
          ${category ? `<span class="arrival-card__category">${category}</span>` : ""}
          <h3 class="arrival-card__name">${name}</h3>
          <div class="arrival-card__footer">
            <div class="arrival-card__rating">
              ${
                hasReviews
                  ? `<div class="arrival-card__stars">${generateStars(rating)}</div><span class="arrival-card__reviews">(${reviewCount})</span>`
                  : `<span class="arrival-card__no-reviews">No reviews yet</span>`
              }
            </div>
            <p class="arrival-card__price">${price}</p>
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
      const countEl = document.getElementById("wishlistItemCount");
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

    // Clear All button
    const clearBtn = document.getElementById("clearWishlistBtn");
    clearBtn?.addEventListener("click", () => {
      const wishlist = getWishlist();
      if (!wishlist.length) return;
      if (!confirm("Remove all items from your wishlist?")) return;
      // Clear the wishlist entirely
      localStorage.setItem(WISHLIST_KEY, JSON.stringify([]));
      if (wishlistGrid) wishlistGrid.innerHTML = "";
      if (wishlistGrid) wishlistGrid.hidden = true;
      if (wishlistEmpty) wishlistEmpty.hidden = false;
      const countEl = document.getElementById("wishlistItemCount");
      if (countEl) countEl.textContent = "0";
      const actionsEl = document.getElementById("wishlistActions");
      if (actionsEl) actionsEl.hidden = true;
      window.UTILS?.toast?.("Wishlist cleared", "info");
      // Notify other pages/components
      window.dispatchEvent(new CustomEvent("wishlist:changed"));
      // Trigger storage event for cross-tab sync
      localStorage.setItem("LBS_WISHLIST_UPDATED", Date.now().toString());
    });

    // Wishlist grid actions
    wishlistGrid?.addEventListener("click", async (e) => {
      // Remove from wishlist
      const removeBtn = e.target.closest("[data-action='remove-wishlist']");
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const productId = removeBtn.dataset.id;
        if (productId && removeFromWishlist(productId)) {
          // Animate card removal
          const card = removeBtn.closest(".arrival-card");
          if (card) {
            card.style.transition = "all 0.3s ease";
            card.style.opacity = "0";
            card.style.transform = "scale(0.8)";
            setTimeout(() => {
              card.remove();
              // Update wishlist count display
              const countEl = document.getElementById("wishlistItemCount");
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

      // Quick view button
      const quickViewBtn = e.target.closest("[data-action='quick-view']");
      if (quickViewBtn) {
        e.preventDefault();
        e.stopPropagation();
        const card = quickViewBtn.closest(".arrival-card");
        const productId = card?.dataset.productId;
        if (productId && window.SHOP?.openModal) {
          window.SHOP.openModal(productId);
        }
        return;
      }

      // Card click opens quick view (but not on buttons)
      const card = e.target.closest(".arrival-card");
      if (card && !e.target.closest("button")) {
        e.preventDefault();
        const productId = card.dataset.productId;
        if (productId && window.SHOP?.openModal) {
          window.SHOP.openModal(productId);
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
