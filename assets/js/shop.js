/**
 * Lingerie by Sisioyin - Shop Page
 * Complete e-commerce shop with filtering, sorting, and product management
 */

(function () {
  "use strict";
  console.log("🛍️ SHOP: Module initializing");

  /* ─────────────────────────────────────────────
   * DOM Elements
   * ───────────────────────────────────────────── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const productsGrid = $("#productsGrid");
  const productsLoading = $("#productsLoading");
  const noResults = $("#noResults");
  const resultsCount = $("#resultsCount");
  const filterForm = $("#filterForm");
  const priceRange = $("#priceRange");
  const priceValue = $("#priceValue");
  const sortSelect = $("#sortSelect");
  const searchInput = $("#searchInput");
  const searchBar = $("#searchBar");
  const searchToggle = $("#searchToggle");
  const searchClose = $("#searchClose");
  const sizeChips = $("#sizeChips");
  const resetFiltersBtn = $("#resetFilters");
  const clearFiltersBtn = $("#clearFiltersBtn");
  const filterToggle = $("#filterToggle");
  const shopSidebar = $("#shopSidebar");
  const sidebarClose = $("#sidebarClose");
  const pageOverlay = $("#pageOverlay");

  // Modal elements
  const variantModal = $("#variantModal");
  const modalClose = $("#modalClose");
  const modalImg = $("#modalImg");
  const modalTitle = $("#modalTitle");
  const modalPrice = $("#modalPrice");
  const modalDesc = $("#modalDesc");
  const modalSizes = $("#modalSizes");
  const modalBadge = $("#modalBadge");
  const modalAddToCart = $("#modalAddToCart");
  const qtyValue = $("#qtyValue");
  const qtyMinus = $("#qtyMinus");
  const qtyPlus = $("#qtyPlus");

  /* ─────────────────────────────────────────────
   * State
   * ───────────────────────────────────────────── */
  let allProducts = [];
  let filteredProducts = [];
  let currentView = "grid";
  let modalProduct = null;
  let modalSelectedSize = "";
  let modalQty = 1;

  /* ─────────────────────────────────────────────
   * Utilities
   * ───────────────────────────────────────────── */
  const formatPrice = (amount) => UTILS.formatNaira(amount);
  const safeText = (str) => UTILS.safeText(str);
  const parseCSV = (str) => UTILS.parseCSV(str);
  const debounce = UTILS.debounce;
  const toast = (msg, type) => UTILS.toast(msg, type);

  function getFirstImage(images) {
    if (Array.isArray(images) && images.length) return images[0];
    if (typeof images === "string" && images.trim())
      return images.split(",")[0].trim();
    return "https://placehold.co/400x500/f8fafc/be185d?text=No+Image";
  }

  /* ─────────────────────────────────────────────
   * Fetch Products
   * ───────────────────────────────────────────── */
  async function fetchProducts() {
    console.log("🛍️ SHOP: fetchProducts()");
    const client = window.DB?.client;
    if (!client) {
      console.warn("🛍️ SHOP: Supabase client not ready");
      return [];
    }

    try {
      const { data, error } = await client
        .from("products")
        .select(
          "id, name, price_ngn, category, gender, sizes, colors, images, is_active, is_new, description",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("🛍️ SHOP: Error fetching products:", error);
        return [];
      }

      console.log("🛍️ SHOP: Fetched", data?.length || 0, "products");

      return (data || []).map((p) => ({
        ...p,
        sizes: Array.isArray(p.sizes) ? p.sizes : parseCSV(p.sizes),
        colors: Array.isArray(p.colors) ? p.colors : parseCSV(p.colors),
        images: Array.isArray(p.images) ? p.images : parseCSV(p.images),
      }));
    } catch (err) {
      console.error("🛍️ SHOP: Fetch error:", err);
      return [];
    }
  }

  /* ─────────────────────────────────────────────
   * Render Products
   * ───────────────────────────────────────────── */
  function createProductCard(product) {
    console.log("🛍️ SHOP: createProductCard()", product?.name);
    const img = getFirstImage(product.images);
    const name = safeText(product.name);
    const price = formatPrice(product.price_ngn);
    const category = safeText(product.category);
    const description = safeText(product.description || "");
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
          <img src="${img}" alt="${name}" loading="lazy" />
          ${isNew ? '<span class="product-badge">New</span>' : ""}
          <div class="product-overlay">
            <div class="product-overlay-buttons">
              <button type="button" class="overlay-btn quick-view-btn" data-id="${product.id}" aria-label="Quick view">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button type="button" class="overlay-btn wishlist-btn ${isWishlisted ? "active" : ""}" data-action="wishlist" data-id="${product.id}" aria-label="Add to wishlist">
                <i class="${isWishlisted ? "fa-solid" : "fa-regular"} fa-heart"></i>
              </button>
            </div>
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
          ${description ? `<p class="product-description">${UTILS.truncate(description, 80)}</p>` : ""}
          <div class="product-meta">
            <span class="product-price">${price}</span>
          </div>
          <button type="button" class="product-add-btn add-cart-btn" data-id="${product.id}">
            <i class="fa-solid fa-bag-shopping"></i>
            <span>Add to Cart</span>
          </button>
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

  function renderProducts(products) {
    console.log("🛍️ SHOP: renderProducts()", products?.length || 0, "products");
    if (!productsGrid) return;

    if (productsLoading) productsLoading.hidden = true;

    if (!products.length) {
      productsGrid.innerHTML = "";
      if (noResults) noResults.hidden = false;
      if (resultsCount) resultsCount.textContent = "0";
      return;
    }

    if (noResults) noResults.hidden = true;
    if (resultsCount) resultsCount.textContent = String(products.length);

    productsGrid.className =
      currentView === "list" ? "products-grid list-view" : "products-grid";
    productsGrid.innerHTML = products.map(createProductCard).join("");
  }

  /* ─────────────────────────────────────────────
   * Filtering & Sorting
   * ───────────────────────────────────────────── */
  function getFilterValues() {
    console.log("🛍️ SHOP: getFilterValues()");
    const formData = filterForm ? new FormData(filterForm) : new FormData();
    const category = formData.get("category") || "";
    const gender = formData.get("gender") || "";
    const maxPrice = parseInt(priceRange?.value || "100000", 10);
    const sortBy = sortSelect?.value || "newest";
    const searchQuery = (searchInput?.value || "").toLowerCase().trim();

    const selectedSizes = Array.from($$("#sizeChips .size-chip.active")).map(
      (btn) => btn.dataset.size,
    );

    return { category, gender, maxPrice, sortBy, searchQuery, selectedSizes };
  }

  function applyFilters() {
    console.log("🛍️ SHOP: applyFilters()");
    const { category, gender, maxPrice, sortBy, searchQuery, selectedSizes } =
      getFilterValues();

    console.log("🛍️ SHOP: Filters -", {
      category,
      gender,
      maxPrice,
      sortBy,
      searchQuery,
      selectedSizes,
    });

    let products = [...allProducts];

    // Filter by category
    if (category) {
      products = products.filter((p) => p.category === category);
    }

    // Filter by gender
    if (gender) {
      products = products.filter((p) => p.gender === gender);
    }

    // Filter by price
    products = products.filter((p) => (p.price_ngn || 0) <= maxPrice);

    // Filter by sizes
    if (selectedSizes.length) {
      products = products.filter((p) =>
        p.sizes?.some((size) => selectedSizes.includes(size)),
      );
    }

    // Filter by search query
    if (searchQuery) {
      products = products.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchQuery) ||
          p.category?.toLowerCase().includes(searchQuery) ||
          p.description?.toLowerCase().includes(searchQuery),
      );
    }

    // Sort
    switch (sortBy) {
      case "price-low":
        products.sort((a, b) => (a.price_ngn || 0) - (b.price_ngn || 0));
        break;
      case "price-high":
        products.sort((a, b) => (b.price_ngn || 0) - (a.price_ngn || 0));
        break;
      case "name":
        products.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "newest":
      default:
        break;
    }

    filteredProducts = products;
    renderProducts(filteredProducts);
  }

  const debouncedApplyFilters = debounce(applyFilters, 250);

  function resetFilters() {
    console.log("🛍️ SHOP: resetFilters()");
    // Reset category and gender dropdowns
    const categorySelect = $("#categorySelect");
    const genderSelect = $("#genderSelect");
    if (categorySelect) categorySelect.value = "";
    if (genderSelect) genderSelect.value = "";

    // Reset size chips
    $$("#sizeChips .size-chip").forEach((chip) => {
      chip.classList.remove("active");
    });

    // Reset price range
    if (priceRange) {
      priceRange.value = "100000";
      if (priceValue) priceValue.textContent = formatPrice(100000);
    }

    // Reset sort
    if (sortSelect) sortSelect.value = "newest";

    // Reset search
    if (searchInput) searchInput.value = "";

    applyFilters();
    closeSidebar();
  }

  /* ─────────────────────────────────────────────
   * URL Params
   * ───────────────────────────────────────────── */
  function applyURLParams() {
    console.log("🛍️ SHOP: applyURLParams()");
    const params = new URLSearchParams(window.location.search);
    console.log("🛍️ SHOP: URL params:", Object.fromEntries(params));

    const category = params.get("category");
    if (category) {
      const select = $("#categorySelect");
      if (select) select.value = category;
    }

    const gender = params.get("gender");
    if (gender) {
      const select = $("#genderSelect");
      if (select) select.value = gender;
    }

    const search = params.get("search") || params.get("q");
    if (search && searchInput) {
      searchInput.value = search;
    }
  }

  /* ─────────────────────────────────────────────
   * Modal Functions - Image Gallery Support
   * ───────────────────────────────────────────── */
  let modalImages = [];
  let currentImageIndex = 0;

  function updateGalleryImage(index) {
    if (!modalImages.length) return;

    currentImageIndex = index;
    if (modalImg) {
      modalImg.src = modalImages[index];
      modalImg.classList.add("fade-in");
      setTimeout(() => modalImg.classList.remove("fade-in"), 300);
    }

    // Update active thumb
    const thumbs = $$("#modalThumbs .gallery-thumb");
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle("active", i === index);
    });

    // Update nav buttons visibility
    const prevBtn = $("#galleryPrev");
    const nextBtn = $("#galleryNext");
    if (prevBtn) prevBtn.hidden = modalImages.length <= 1;
    if (nextBtn) nextBtn.hidden = modalImages.length <= 1;
  }

  function openModal(product) {
    console.log("🛍️ SHOP: openModal()", product?.name);
    if (!variantModal || !product) return;

    modalProduct = product;
    modalSelectedSize = "";
    modalQty = 1;
    currentImageIndex = 0;

    // Parse images array
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

    if (!modalImages.length) {
      modalImages = [
        "https://placehold.co/400x500/f8fafc/be185d?text=No+Image",
      ];
    }

    const img = modalImages[0];

    if (modalImg) {
      modalImg.src = img;
      modalImg.alt = product.name || "Product";
    }

    // Build thumbnails
    const thumbsEl = $("#modalThumbs");
    if (thumbsEl) {
      if (modalImages.length > 1) {
        thumbsEl.innerHTML = modalImages
          .map(
            (imgUrl, idx) => `
            <button type="button" class="gallery-thumb${idx === 0 ? " active" : ""}" data-index="${idx}">
              <img src="${imgUrl}" alt="Thumbnail ${idx + 1}">
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
    const prevBtn = $("#galleryPrev");
    const nextBtn = $("#galleryNext");
    if (prevBtn) prevBtn.hidden = modalImages.length <= 1;
    if (nextBtn) nextBtn.hidden = modalImages.length <= 1;

    if (modalTitle) modalTitle.textContent = product.name || "Product";
    if (modalPrice) modalPrice.textContent = formatPrice(product.price_ngn);
    if (modalDesc) modalDesc.textContent = product.description || "";
    if (qtyValue) qtyValue.textContent = "1";

    if (modalBadge) {
      modalBadge.hidden = !product.is_new;
      modalBadge.textContent = "New";
    }

    const sizes = product.sizes?.length ? product.sizes : ["One Size"];
    if (modalSizes) {
      modalSizes.innerHTML = sizes
        .map((s, idx) => {
          const label = safeText(s);
          const isDefault = sizes.length === 1;
          if (isDefault) modalSelectedSize = s;
          return `<button type="button" class="size-btn${isDefault ? " active" : ""}" data-size="${label}">${label}</button>`;
        })
        .join("");
    }

    // Add social share buttons
    renderShareButtons(product);

    // Load reviews
    loadProductReviews(product.id);

    // Load related products
    loadRelatedProducts(product);

    // Track recently viewed
    if (window.APP?.addToRecentlyViewed) {
      window.APP.addToRecentlyViewed({
        id: product.id,
        name: product.name,
        price_ngn: product.price_ngn,
        image: img,
      });
    }

    variantModal.classList.add("open");
    variantModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  /* ─────────────────────────────────────────────
   * Social Share Buttons
   * ───────────────────────────────────────────── */
  function renderShareButtons(product) {
    const container = $("#modalShareButtons");
    if (!container) return;

    const url = `${window.location.origin}/shop.html?product=${product.id}`;
    const name = encodeURIComponent(product.name);

    container.innerHTML = `
      <div class="share-buttons">
        <button type="button" class="share-btn whatsapp" onclick="window.APP?.shareProduct?.('whatsapp', '${safeText(product.name)}', '${url}')" title="Share on WhatsApp">
          <i class="fa-brands fa-whatsapp"></i>
        </button>
        <button type="button" class="share-btn facebook" onclick="window.APP?.shareProduct?.('facebook', '${safeText(product.name)}', '${url}')" title="Share on Facebook">
          <i class="fa-brands fa-facebook-f"></i>
        </button>
        <button type="button" class="share-btn x" onclick="window.APP?.shareProduct?.('x', '${safeText(product.name)}', '${url}')" title="Share on X">
          <i class="fa-brands fa-x-twitter"></i>
        </button>
        <button type="button" class="share-btn instagram" onclick="window.APP?.shareProduct?.('instagram', '${safeText(product.name)}', '${url}')" title="Share on Instagram">
          <i class="fa-brands fa-instagram"></i>
        </button>
        <button type="button" class="share-btn tiktok" onclick="window.APP?.shareProduct?.('tiktok', '${safeText(product.name)}', '${url}')" title="Share on TikTok">
          <i class="fa-brands fa-tiktok"></i>
        </button>
        <button type="button" class="share-btn copy" onclick="window.APP?.shareProduct?.('copy', '${safeText(product.name)}', '${url}')" title="Copy link">
          <i class="fa-solid fa-link"></i>
        </button>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
   * Product Reviews
   * ───────────────────────────────────────────── */
  async function loadProductReviews(productId) {
    const container = $("#modalReviews");
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    try {
      const client = window.DB?.client;
      if (!client) return;

      const { data, error } = await client
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = `
          <div class="product-reviews-section">
            <div class="reviews-header">
              <span class="reviews-title">Customer Reviews</span>
            </div>
            <div class="no-reviews">
              <i class="fa-regular fa-comment"></i>
              <p>No reviews yet. Be the first to review!</p>
            </div>
          </div>
        `;
        return;
      }

      const avgRating =
        data.reduce((sum, r) => sum + r.rating, 0) / data.length;

      container.innerHTML = `
        <div class="product-reviews-section">
          <div class="reviews-header">
            <span class="reviews-title">Customer Reviews</span>
            <span class="reviews-summary">
              <span class="stars">${renderStars(avgRating)}</span>
              ${avgRating.toFixed(1)} (${data.length} review${data.length !== 1 ? "s" : ""})
            </span>
          </div>
          <div class="reviews-list">
            ${data
              .map(
                (review) => `
              <div class="review-item">
                <div class="review-header">
                  <span class="review-author">${safeText(review.reviewer_name || "Customer")}</span>
                  <span class="review-date">${new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <div class="review-rating">${renderStars(review.rating)}</div>
                <p class="review-text">${safeText(review.comment || "")}</p>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    } catch (err) {
      console.error("Error loading reviews:", err);
      container.innerHTML = "";
    }
  }

  function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return (
      '<i class="fa-solid fa-star"></i>'.repeat(full) +
      (half ? '<i class="fa-solid fa-star-half-stroke"></i>' : "") +
      '<i class="fa-regular fa-star"></i>'.repeat(empty)
    );
  }

  /* ─────────────────────────────────────────────
   * Related Products
   * ───────────────────────────────────────────── */
  async function loadRelatedProducts(product) {
    const container = $("#modalRelated");
    if (!container) return;

    container.innerHTML = "";

    try {
      // Find products in same category, excluding current product
      const related = allProducts
        .filter((p) => p.id !== product.id && p.category === product.category)
        .slice(0, 3);

      if (related.length === 0) {
        // If no same category, show random products
        const random = allProducts
          .filter((p) => p.id !== product.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        if (random.length === 0) return;

        renderRelatedProducts(container, random);
      } else {
        renderRelatedProducts(container, related);
      }
    } catch (err) {
      console.error("Error loading related products:", err);
    }
  }

  function renderRelatedProducts(container, products) {
    container.innerHTML = `
      <div class="related-products-section">
        <h4 class="related-products-title">You May Also Like</h4>
        <div class="related-products-grid">
          ${products
            .map(
              (p) => `
            <div class="related-product-card" data-product-id="${p.id}">
              <img src="${getFirstImage(p.images)}" alt="${safeText(p.name)}" loading="lazy">
              <div class="related-product-info">
                <div class="related-product-name">${safeText(p.name)}</div>
                <div class="related-product-price">${formatPrice(p.price_ngn)}</div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;

    // Add click handlers for related products
    container.querySelectorAll(".related-product-card").forEach((card) => {
      card.addEventListener("click", () => {
        const productId = card.dataset.productId;
        const relatedProduct = allProducts.find((p) => p.id === productId);
        if (relatedProduct) {
          openModal(relatedProduct);
        }
      });
    });
  }

  function closeModal() {
    console.log("🛍️ SHOP: closeModal()");
    if (!variantModal) return;
    variantModal.classList.remove("open");
    variantModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    modalProduct = null;
    modalSelectedSize = "";
    modalQty = 1;
  }

  function addToCartFromModal() {
    console.log("🛍️ SHOP: addToCartFromModal()");
    if (!modalProduct) return;

    if (!modalSelectedSize) {
      console.log("🛍️ SHOP: No size selected");
      toast("Please select a size", "warning");
      return;
    }

    console.log(
      "🛍️ SHOP: Adding to cart -",
      modalProduct.name,
      modalSelectedSize,
      "x",
      modalQty,
    );
    const variantId = `${modalProduct.id}-${modalSelectedSize}`;
    const item = {
      variantId,
      id: modalProduct.id,
      name: modalProduct.name,
      price_ngn: modalProduct.price_ngn,
      selectedSize: modalSelectedSize,
      image: getFirstImage(modalProduct.images),
      qty: modalQty,
    };

    if (window.APP?.addToCart) {
      window.APP.addToCart(item);
      closeModal();
    } else {
      console.error("Cart system not available");
    }
  }

  function quickAddToCart(productId) {
    console.log("🛍️ SHOP: quickAddToCart()", productId);
    const product = allProducts.find((p) => p.id === productId);
    if (!product) {
      console.warn("🛍️ SHOP: Product not found:", productId);
      return;
    }

    const sizes = product.sizes?.length ? product.sizes : ["One Size"];

    if (sizes.length === 1) {
      const variantId = `${product.id}-${sizes[0]}`;
      const item = {
        variantId,
        id: product.id,
        name: product.name,
        price_ngn: product.price_ngn,
        selectedSize: sizes[0],
        image: getFirstImage(product.images),
        qty: 1,
      };

      if (window.APP?.addToCart) {
        window.APP.addToCart(item);
      }
    } else {
      openModal(product);
    }
  }

  /* ─────────────────────────────────────────────
   * UI Functions
   * ───────────────────────────────────────────── */
  function openSidebar() {
    console.log("🛍️ SHOP: openSidebar()");
    if (!shopSidebar) return;
    shopSidebar.classList.add("open");
    pageOverlay?.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    console.log("🛍️ SHOP: closeSidebar()");
    if (!shopSidebar) return;
    shopSidebar.classList.remove("open");
    pageOverlay?.classList.remove("active");
    document.body.style.overflow = "";
  }

  function openSearch() {
    console.log("🛍️ SHOP: openSearch()");
    if (!searchBar) return;
    searchBar.hidden = false;
    searchInput?.focus();
  }

  function closeSearch() {
    console.log("🛍️ SHOP: closeSearch()");
    if (!searchBar) return;
    searchBar.hidden = true;
    if (searchInput) searchInput.value = "";
    applyFilters();
  }

  /* ─────────────────────────────────────────────
   * Event Listeners
   * ───────────────────────────────────────────── */
  function setupEventListeners() {
    console.log("🛍️ SHOP: setupEventListeners()");
    // Filter form changes
    filterForm?.addEventListener("change", debouncedApplyFilters);

    // Price range
    priceRange?.addEventListener("input", (e) => {
      if (priceValue) priceValue.textContent = formatPrice(e.target.value);
      debouncedApplyFilters();
    });

    // Sort change
    sortSelect?.addEventListener("change", applyFilters);

    // Size chips
    sizeChips?.addEventListener("click", (e) => {
      const chip = e.target.closest(".size-chip");
      if (chip) {
        chip.classList.toggle("active");
        applyFilters();
      }
    });

    // Reset filters
    resetFiltersBtn?.addEventListener("click", resetFilters);
    clearFiltersBtn?.addEventListener("click", resetFilters);

    // Search
    searchToggle?.addEventListener("click", openSearch);
    searchClose?.addEventListener("click", closeSearch);
    searchInput?.addEventListener("input", debouncedApplyFilters);

    // Mobile filter sidebar
    filterToggle?.addEventListener("click", openSidebar);
    sidebarClose?.addEventListener("click", closeSidebar);
    pageOverlay?.addEventListener("click", () => {
      closeSidebar();
      closeModal();
    });

    // View toggle (handles both desktop and mobile view toggles)
    $$(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Sync all view buttons across desktop and mobile
        $$(".view-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.view === btn.dataset.view);
        });
        currentView = btn.dataset.view || "grid";
        renderProducts(filteredProducts);
      });
    });

    // Products grid events (delegation)
    productsGrid?.addEventListener("click", (e) => {
      const quickViewBtn = e.target.closest(".quick-view-btn");
      const addCartBtn = e.target.closest(".add-cart-btn");
      const productCard = e.target.closest(".product-card");

      if (quickViewBtn) {
        const id = quickViewBtn.dataset.id;
        const product = allProducts.find((p) => p.id === id);
        if (product) openModal(product);
        return;
      }

      if (addCartBtn) {
        const id = addCartBtn.dataset.id;
        quickAddToCart(id);
        return;
      }

      // Click on card opens modal
      if (productCard && !quickViewBtn && !addCartBtn) {
        const id = productCard.dataset.productId;
        const product = allProducts.find((p) => p.id === id);
        if (product) openModal(product);
      }
    });

    // Modal events
    modalClose?.addEventListener("click", closeModal);
    variantModal?.addEventListener("click", (e) => {
      if (e.target === variantModal) closeModal();
    });

    // Modal size selection
    modalSizes?.addEventListener("click", (e) => {
      const sizeBtn = e.target.closest(".size-btn");
      if (sizeBtn) {
        $$("#modalSizes .size-btn").forEach((b) =>
          b.classList.remove("active"),
        );
        sizeBtn.classList.add("active");
        modalSelectedSize = sizeBtn.dataset.size;
      }
    });

    // Modal quantity
    qtyMinus?.addEventListener("click", () => {
      modalQty = Math.max(1, modalQty - 1);
      if (qtyValue) qtyValue.textContent = String(modalQty);
    });

    qtyPlus?.addEventListener("click", () => {
      modalQty = Math.min(99, modalQty + 1);
      if (qtyValue) qtyValue.textContent = String(modalQty);
    });

    // Gallery navigation - Previous
    $("#galleryPrev")?.addEventListener("click", () => {
      if (modalImages.length <= 1) return;
      let newIndex = currentImageIndex - 1;
      if (newIndex < 0) newIndex = modalImages.length - 1;
      updateGalleryImage(newIndex);
    });

    // Gallery navigation - Next
    $("#galleryNext")?.addEventListener("click", () => {
      if (modalImages.length <= 1) return;
      let newIndex = currentImageIndex + 1;
      if (newIndex >= modalImages.length) newIndex = 0;
      updateGalleryImage(newIndex);
    });

    // Thumbnail clicks
    document.addEventListener("click", (e) => {
      const thumb = e.target.closest(".gallery-thumb");
      if (!thumb) return;
      const index = parseInt(thumb.dataset.index, 10);
      if (!isNaN(index)) updateGalleryImage(index);
    });

    // Add to cart from modal
    modalAddToCart?.addEventListener("click", addToCartFromModal);

    // Keyboard
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeSidebar();
        closeSearch();
      }
    });

    // Realtime updates
    window.addEventListener("products:changed", async () => {
      console.log("🛍️ SHOP: Products changed event received");
      allProducts = await fetchProducts();
      applyFilters();
    });
  }

  /* ─────────────────────────────────────────────
   * Recently Viewed
   * ───────────────────────────────────────────── */
  function renderRecentlyViewed() {
    const section = $("#recentlyViewedSection");
    const grid = $("#recentlyViewedGrid");
    if (!section || !grid) return;

    const items = window.APP?.getRecentlyViewed?.() || [];

    if (items.length === 0) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    grid.innerHTML = items
      .map(
        (item) => `
      <div class="recently-viewed-item" data-product-id="${item.id}">
        <img src="${item.image}" alt="${safeText(item.name)}" loading="lazy">
        <div class="item-info">
          <div class="item-name">${safeText(item.name)}</div>
          <div class="item-price">${formatPrice(item.price_ngn)}</div>
        </div>
      </div>
    `,
      )
      .join("");

    // Add click handlers
    grid.querySelectorAll(".recently-viewed-item").forEach((item) => {
      item.addEventListener("click", () => {
        const productId = item.dataset.productId;
        const product = allProducts.find((p) => p.id === productId);
        if (product) {
          openModal(product);
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
   * Initialize
   * ───────────────────────────────────────────── */
  async function init() {
    console.log("🛍️ SHOP: init()");
    if (productsLoading) productsLoading.hidden = false;
    if (noResults) noResults.hidden = true;

    setupEventListeners();
    applyURLParams();

    // Wait for Supabase
    let attempts = 0;
    while (!window.DB?.isReady && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      attempts++;
    }
    console.log("🛍️ SHOP: Supabase ready after", attempts, "attempts");

    allProducts = await fetchProducts();
    applyFilters();

    // Render recently viewed after products load
    renderRecentlyViewed();

    console.log("✅ SHOP: Initialization complete");
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
