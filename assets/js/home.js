/**
 * Lingerie by Sisioyin - Home Page
 * Handles new arrivals and home page functionality
 */

(async function () {
  "use strict";
  console.log("🏠 HOME: Module initializing");

  /* ─────────────────────────────────────────────
   * DOM Elements
   * ───────────────────────────────────────────── */
  const grid = document.querySelector("[data-home-products]");
  const loader = document.getElementById("homeLoading");

  if (!grid) {
    console.log("🏠 HOME: No product grid found, exiting");
    return;
  }

  /* ─────────────────────────────────────────────
   * Supabase Client
   * ───────────────────────────────────────────── */
  const getClient = () => window.DB?.client || null;

  /* ─────────────────────────────────────────────
   * Fetch Products
   * ───────────────────────────────────────────── */
  async function fetchNewArrivals() {
    console.log("🏠 HOME: fetchNewArrivals()");
    const client = getClient();
    if (!client) {
      console.warn("🏠 HOME: No Supabase client available");
      return { data: [], error: null };
    }

    // Try with is_new filter first
    let res = await client
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq("is_new", true)
      .order("created_at", { ascending: false })
      .limit(8);

    console.log(
      "🏠 HOME: New arrivals query result:",
      res.data?.length || 0,
      "items",
    );

    // Fallback if is_new doesn't return results
    if (!res.data?.length) {
      console.log("🏠 HOME: Fallback to latest products");
      res = await client
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);
    }

    return res;
  }

  /* ─────────────────────────────────────────────
   * Render Product Card
   * ───────────────────────────────────────────── */
  function getFirstImage(images) {
    if (Array.isArray(images) && images.length) return images[0];
    if (typeof images === "string" && images.trim())
      return images.split(",")[0].trim();
    return "https://placehold.co/400x500/f8fafc/be185d?text=No+Image";
  }

  function createProductCard(product) {
    console.log("🏠 HOME: createProductCard()", product?.name);
    const imageUrl = getFirstImage(product.images);
    const name = UTILS.safeText(product.name || "Product");
    const category = UTILS.safeText(product.category || "");
    const price = UTILS.formatNaira(product.price_ngn || 0);
    const isNew = Boolean(product.is_new);
    // Use real ratings from database only - no fake data
    const rating = product.avg_rating || 0;
    const reviewCount = product.review_count || 0;
    const hasReviews = reviewCount > 0;

    // Check if product is in wishlist
    const wishlist = JSON.parse(localStorage.getItem("LBS_WISHLIST") || "[]");
    const isWishlisted = wishlist.includes(String(product.id));

    return `
      <article class="product-card" data-product-id="${product.id}">
        <div class="product-image">
          <img src="${imageUrl}" alt="${name}" loading="lazy" />
          ${isNew ? '<span class="product-badge">New</span>' : ""}
          <div class="product-overlay">
            <div class="product-overlay-buttons">
              <button type="button" class="overlay-btn" data-action="quick-view" aria-label="Quick view">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button type="button" class="overlay-btn wishlist-btn ${isWishlisted ? "active" : ""}" data-action="wishlist" data-id="${product.id}" aria-label="Add to wishlist">
                <i class="${isWishlisted ? "fa-solid" : "fa-regular"} fa-heart"></i>
              </button>
            </div>
            <button type="button" class="quick-add-btn" data-action="quick-add">
              <i class="fa-solid fa-bag-shopping"></i>
              Add to Cart
            </button>
          </div>
        </div>
        <div class="product-info">
          ${category ? `<span class="product-category">${category}</span>` : ""}
          <h3 class="product-name">${name}</h3>
          ${
            hasReviews
              ? `
          <div class="product-rating">
            <div class="stars">
              ${generateStars(rating)}
            </div>
            <span class="rating-count">(${reviewCount})</span>
          </div>`
              : `
          <div class="product-rating no-reviews">
            <span class="no-rating-text">No reviews yet</span>
          </div>`
          }
          <p class="product-price">${price}</p>
        </div>
      </article>
    `;
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

  /* ─────────────────────────────────────────────
   * Render Grid
   * ───────────────────────────────────────────── */
  function render(products) {
    console.log("🏠 HOME: render()", products?.length || 0, "products");
    if (!products?.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-box-open"></i></div>
          <h3 class="empty-title">No products yet</h3>
          <p class="empty-text">Check back soon for new arrivals!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(createProductCard).join("");
  }

  /* ─────────────────────────────────────────────
   * Show/Hide Loading
   * ───────────────────────────────────────────── */
  function showLoading() {
    console.log("🏠 HOME: showLoading()");
    if (loader) loader.hidden = false;
    grid.innerHTML = "";
  }

  function hideLoading() {
    console.log("🏠 HOME: hideLoading()");
    if (loader) loader.hidden = true;
  }

  /* ─────────────────────────────────────────────
   * Load Products
   * ───────────────────────────────────────────── */
  async function loadProducts() {
    console.log("🏠 HOME: loadProducts()");
    showLoading();

    const { data, error } = await fetchNewArrivals();

    hideLoading();

    if (error) {
      console.error("🏠 HOME: Error loading products:", error);
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-exclamation-circle"></i></div>
          <h3 class="empty-title">Failed to load products</h3>
          <p class="empty-text">Please try again later.</p>
          <button type="button" class="btn btn-primary" onclick="location.reload()">
            <i class="fa-solid fa-rotate-right"></i> Retry
          </button>
        </div>
      `;
      return;
    }

    render(data || []);
  }

  /* ─────────────────────────────────────────────
   * Testimonials / Reviews Section
   * ───────────────────────────────────────────── */
  const testimonialsGrid = document.getElementById("testimonialsGrid");
  const testimonialsEmpty = document.getElementById("testimonialsEmpty");
  const reviewModal = document.getElementById("reviewModal");
  const reviewForm = document.getElementById("reviewForm");
  const openReviewBtn = document.getElementById("openReviewModal");
  const closeReviewBtn = document.getElementById("closeReviewModal");
  const cancelReviewBtn = document.getElementById("cancelReview");
  const ratingInput = document.getElementById("ratingInput");
  let selectedRating = 0;

  // Load testimonials from database
  async function loadTestimonials() {
    if (!testimonialsGrid) return;

    console.log("🏠 HOME: Loading testimonials...");
    const client = getClient();

    if (!client) {
      console.warn("🏠 HOME: No Supabase client for testimonials");
      showEmptyTestimonials();
      return;
    }

    try {
      const { data, error } = await client
        .from("testimonials")
        .select("*")
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;

      if (!data || data.length === 0) {
        showEmptyTestimonials();
        return;
      }

      renderTestimonials(data);
    } catch (err) {
      console.error("🏠 HOME: Error loading testimonials:", err);
      showEmptyTestimonials();
    }
  }

  function renderTestimonials(testimonials) {
    if (!testimonialsGrid) return;

    testimonialsGrid.innerHTML = testimonials
      .map(
        (t) => `
      <div class="testimonial-card">
        <div class="testimonial-rating">
          ${generateStars(t.rating || 5)}
        </div>
        <p class="testimonial-text">"${UTILS.safeText(t.comment)}"</p>
        <div class="testimonial-author">
          <div class="author-avatar">
            <i class="fa-solid fa-user"></i>
          </div>
          <div class="author-info">
            <h4 class="author-name">${UTILS.safeText(t.customer_name)}</h4>
            ${t.customer_location ? `<span class="author-location">${UTILS.safeText(t.customer_location)}</span>` : ""}
          </div>
        </div>
      </div>
    `,
      )
      .join("");

    if (testimonialsEmpty) testimonialsEmpty.style.display = "none";
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
    for (let i = fullStars + (hasHalf ? 1 : 0); i < 5; i++) {
      stars += '<i class="fa-regular fa-star"></i>';
    }
    return stars;
  }

  function showEmptyTestimonials() {
    if (testimonialsGrid) testimonialsGrid.innerHTML = "";
    if (testimonialsEmpty) testimonialsEmpty.style.display = "block";
  }

  // Review Modal
  function openReviewModal() {
    if (reviewModal) {
      reviewModal.style.display = "flex";
      document.body.style.overflow = "hidden";
    }
  }

  function closeReviewModal() {
    if (reviewModal) {
      reviewModal.style.display = "none";
      document.body.style.overflow = "";
      resetReviewForm();
    }
  }

  function resetReviewForm() {
    if (reviewForm) reviewForm.reset();
    selectedRating = 0;
    updateRatingStars();
  }

  function updateRatingStars() {
    if (!ratingInput) return;
    const stars = ratingInput.querySelectorAll(".rating-star");
    stars.forEach((star, index) => {
      const isActive = index < selectedRating;
      star.classList.toggle("active", isActive);
      const icon = star.querySelector("i");
      if (icon) {
        icon.className = isActive ? "fa-solid fa-star" : "fa-regular fa-star";
      }
    });
    const hiddenInput = document.getElementById("reviewRating");
    if (hiddenInput) hiddenInput.value = selectedRating;
  }

  // Rating click handler
  if (ratingInput) {
    ratingInput.addEventListener("click", (e) => {
      const star = e.target.closest(".rating-star");
      if (star) {
        selectedRating = parseInt(star.dataset.rating);
        updateRatingStars();
      }
    });
  }

  // Open/close modal handlers
  if (openReviewBtn) {
    openReviewBtn.addEventListener("click", openReviewModal);
  }
  if (closeReviewBtn) {
    closeReviewBtn.addEventListener("click", closeReviewModal);
  }
  if (cancelReviewBtn) {
    cancelReviewBtn.addEventListener("click", closeReviewModal);
  }
  if (reviewModal) {
    reviewModal.addEventListener("click", (e) => {
      if (e.target === reviewModal) closeReviewModal();
    });
  }

  // Submit review
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (selectedRating === 0) {
        UTILS.showToast?.("Please select a rating", "error");
        return;
      }

      const formData = new FormData(reviewForm);
      const submitBtn = reviewForm.querySelector('button[type="submit"]');
      const originalText = submitBtn?.innerHTML;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
      }

      const client = getClient();
      if (!client) {
        UTILS.showToast?.(
          "Unable to submit review. Please try again.",
          "error",
        );
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
        return;
      }

      try {
        const { error } = await client.from("testimonials").insert({
          customer_name: formData.get("customer_name"),
          customer_location: formData.get("customer_location") || null,
          rating: selectedRating,
          comment: formData.get("comment"),
          is_approved: false, // Requires admin approval
        });

        if (error) throw error;

        UTILS.showToast?.(
          "Thank you! Your review will be published after approval.",
          "success",
        );
        closeReviewModal();
      } catch (err) {
        console.error("🏠 HOME: Error submitting review:", err);
        UTILS.showToast?.(
          "Failed to submit review. Please try again.",
          "error",
        );
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  /* ─────────────────────────────────────────────
   * Event Handlers
   * ───────────────────────────────────────────── */

  // Quick Add button handler
  grid.addEventListener("click", (e) => {
    const quickAddBtn = e.target.closest('[data-action="quick-add"]');
    const quickViewBtn = e.target.closest('[data-action="quick-view"]');

    const card = e.target.closest("[data-product-id]");
    const productId = card?.dataset.productId;
    if (!productId) return;

    if (quickAddBtn || quickViewBtn) {
      e.preventDefault();
      console.log("🏠 HOME: Quick action clicked for product:", productId);
      // Open variant modal to pick options
      window.APP?.openModal?.(productId) ||
        window.APP?.openVariantModal?.(productId);
    }
  });

  // Realtime refresh
  window.addEventListener("products:changed", () => {
    console.log("🏠 HOME: Products changed event received");
    loadProducts();
  });

  /* ─────────────────────────────────────────────
   * Initialize
   * ───────────────────────────────────────────── */
  console.log("🏠 HOME: Starting initial load");
  loadProducts();
  loadTestimonials();
})();
