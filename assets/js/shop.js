/**
 * Lingerie by Sisioyin - Shop Page
 * Modern e-commerce with unique UX
 */

(function () {
  "use strict";
  console.log("🛍️ SHOP: Initializing");

  // IMMEDIATELY reset all filter checkboxes to prevent browser form restoration
  // This runs before any event listeners are attached
  document
    .querySelectorAll(
      ".shop-sidebar input[type='checkbox'], [data-filter-key] input[type='checkbox']",
    )
    .forEach((cb) => {
      cb.checked = false;
    });

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Elements
  const productsGrid = $("#productsGrid");
  const skeletonGrid = $("#skeletonGrid");
  const noResults = $("#noResults");
  const resultsCount = $("#resultsCount");
  const searchInput = $("#shopSearchInput");
  const sortSelect = $("#sortSelect");
  const filterBar = $("#filterBar");

  // Modal Elements
  const productModal = $("#productModal");

  // State
  let allProducts = [];
  let filteredProducts = [];
  let modalProduct = null;
  let modalSelectedSize = "";
  let modalSelectedColor = "";
  let modalQty = 1;
  let modalImages = [];
  let modalEditIdx = null; // Index of cart item being edited (null = add mode)
  let currentImageIndex = 0;
  let isInitializing = true; // Flag to ignore change events during init
  let activeFilters = {
    category: [],
    gender: [],
    priceRange: "",
    deliveryType: [],
    inStockOnly: false,
    newArrivalsOnly: false,
  };

  // Utilities
  const formatPrice = (n) => `₦${Number(n || 0).toLocaleString()}`;
  const safeText = (s) =>
    String(s || "").replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  // Color name to better CSS color mapping
  const colorMap = {
    blue: "#2563eb",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#eab308",
    orange: "#f97316",
    purple: "#9333ea",
    pink: "#ec4899",
    black: "#1f2937",
    white: "#ffffff",
    grey: "#6b7280",
    gray: "#6b7280",
    brown: "#92400e",
    navy: "#1e3a8a",
    beige: "#d4a574",
    maroon: "#7f1d1d",
    teal: "#0d9488",
    gold: "#ca8a04",
    silver: "#94a3b8",
    cream: "#fef3c7",
    coral: "#f87171",
    lavender: "#c4b5fd",
    peach: "#fdba74",
    nude: "#e8d4c4",
    ivory: "#fffff0",
    burgundy: "#881337",
    mint: "#86efac",
    rose: "#fda4af",
    wine: "#7c2d12",
    chocolate: "#78350f",
    tan: "#d97706",
    camel: "#b45309",
  };

  const getColorValue = (colorName) => {
    const lower = String(colorName || "")
      .toLowerCase()
      .trim();
    return colorMap[lower] || colorName;
  };

  // Alias for cart drawer color dots
  const getColorHex = getColorValue;

  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  const toast = (msg, type) =>
    UTILS?.toast?.(msg, type) || console.log(`[${type}] ${msg}`);

  function getFirstImage(images) {
    if (Array.isArray(images) && images.length) return images[0];
    if (typeof images === "string" && images.trim())
      return images.split(",")[0].trim();
    return "https://placehold.co/400x500/f8fafc/be185d?text=No+Image";
  }

  function parseArray(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return [];
  }

  // Check if product is new (only if marked as new in DB)
  function isNewProduct(createdAt, isNewFlag) {
    // Only consider products explicitly marked as new
    return isNewFlag === true;
  }

  // Fetch Products
  async function fetchProducts() {
    const client = window.DB?.client;
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((p) => ({
        ...p,
        sizes: parseArray(p.sizes),
        colors: parseArray(p.colors),
        images: parseArray(p.images),
      }));
    } catch (err) {
      console.error("Fetch error:", err);
      return [];
    }
  }

  // Loading States
  function showSkeleton() {
    if (skeletonGrid) skeletonGrid.hidden = false;
    if (productsGrid) productsGrid.hidden = true;
    if (noResults) noResults.hidden = true;
  }

  function hideSkeleton() {
    if (skeletonGrid) skeletonGrid.hidden = true;
    if (productsGrid) productsGrid.hidden = false;
  }

  // Create Product Card - Clean modern design
  function createProductCard(p) {
    const imgRaw = getFirstImage(p.images);
    const img = window.UTILS?.optimizedImg
      ? window.UTILS.optimizedImg(imgRaw, 400, 75)
      : imgRaw;
    const name = safeText(p.name);
    const price = formatPrice(p.price_ngn);
    const category = safeText(p.category || "Uncategorized");
    const description = safeText(p.description || "").slice(0, 60);
    const inStock = (p.qty || 0) > 0;
    const deliveryType = p.delivery_type || "standard";
    const isExpress = deliveryType === "express";
    const deliveryLabel = isExpress ? "Same-day" : "Standard";
    const reviewCount = p.review_count || 0;
    const isNew = isNewProduct(p.created_at, p.is_new);

    const wishlist = JSON.parse(localStorage.getItem("LBS_WISHLIST") || "[]");
    const isWishlisted = wishlist.includes(String(p.id));

    return `
      <article class="product-card" data-id="${p.id}">
        <div class="card-image">
          <img src="${img}" alt="${name}" loading="lazy" />
          ${isNew ? '<span class="card-new-badge">New</span>' : ""}
          <button type="button" class="card-wishlist ${isWishlisted ? "active" : ""}" data-id="${p.id}" data-tooltip="${isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}" aria-label="Wishlist">
            <i class="${isWishlisted ? "fa-solid" : "fa-regular"} fa-heart"></i>
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
          <div class="card-review">${reviewCount > 0 ? `<i class="fa-solid fa-star"></i> <span>${reviewCount} reviews</span>` : '<i class="fa-regular fa-star"></i> <span class="no-reviews">No reviews yet</span>'}</div>
          <div class="card-bottom">
            <span class="card-price">${price}</span>
            <button type="button" class="card-cart-btn" data-id="${p.id}" ${!inStock ? "disabled" : ""}>
              <i class="fa-solid fa-bag-shopping"></i> Add to Cart
            </button>
          </div>
        </div>
      </article>
    `;
  }

  // Render Products
  function renderProducts(products) {
    hideSkeleton();
    if (!productsGrid) return;

    if (!products.length) {
      productsGrid.innerHTML = "";
      productsGrid.hidden = true;
      if (noResults) noResults.hidden = false;
      if (resultsCount) resultsCount.textContent = "0 products";
      return;
    }

    if (noResults) noResults.hidden = true;
    productsGrid.hidden = false;
    if (resultsCount) {
      const count = products.length;
      resultsCount.textContent = `${count} ${count === 1 ? "product" : "products"}`;
    }
    productsGrid.innerHTML = products.map(createProductCard).join("");
  }

  // Filter Logic
  function applyFilters() {
    let products = [...allProducts];
    const searchQuery = (searchInput?.value || "").toLowerCase().trim();
    const sortBy = sortSelect?.value || "newest";

    // Category filter (multi-select)
    if (activeFilters.category.length > 0)
      products = products.filter((p) =>
        activeFilters.category.includes(p.category),
      );

    // Gender filter (multi-select)
    if (activeFilters.gender.length > 0)
      products = products.filter((p) =>
        activeFilters.gender.includes(p.gender),
      );

    // Price range filter
    if (activeFilters.priceRange) {
      const [min, max] = activeFilters.priceRange.split("-").map(Number);
      products = products.filter(
        (p) => (p.price_ngn || 0) >= min && (p.price_ngn || 0) <= max,
      );
    }

    // Delivery type filter (multi-select)
    if (activeFilters.deliveryType.length > 0)
      products = products.filter((p) =>
        activeFilters.deliveryType.includes(p.delivery_type),
      );

    // In stock only filter
    if (activeFilters.inStockOnly)
      products = products.filter((p) => (p.qty || 0) > 0);

    // New arrivals only filter
    if (activeFilters.newArrivalsOnly)
      products = products.filter((p) => isNewProduct(p.created_at, p.is_new));

    // Search query filter
    if (searchQuery)
      products = products.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchQuery) ||
          p.category?.toLowerCase().includes(searchQuery) ||
          p.description?.toLowerCase().includes(searchQuery),
      );

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
      case "popular":
        products.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
        break;
    }

    filteredProducts = products;
    renderProducts(products);
    updateActiveFiltersUI();
    updateFilterCount();
  }

  const debouncedFilter = debounce(applyFilters, 300);

  function updateActiveFiltersUI() {
    const chips = $("#activeChips");
    const activeFiltersBar = $("#activeFiltersBar");
    if (!chips) return;

    const tags = [];
    // Handle array-based filters (multi-select)
    activeFilters.category.forEach((val) =>
      tags.push({ key: "category", value: val, label: val }),
    );
    activeFilters.gender.forEach((val) =>
      tags.push({ key: "gender", value: val, label: val }),
    );
    activeFilters.deliveryType.forEach((val) =>
      tags.push({
        key: "deliveryType",
        value: val,
        label: val === "express" ? "Same-day" : "Standard",
      }),
    );
    if (activeFilters.priceRange) {
      const [min, max] = activeFilters.priceRange.split("-").map(Number);
      const minStr = "₦" + min.toLocaleString();
      const maxStr = "₦" + max.toLocaleString();
      tags.push({
        key: "priceRange",
        value: activeFilters.priceRange,
        label: `${minStr} - ${maxStr}`,
      });
    }
    if (activeFilters.inStockOnly)
      tags.push({ key: "inStockOnly", value: true, label: "In Stock" });
    if (activeFilters.newArrivalsOnly)
      tags.push({ key: "newArrivalsOnly", value: true, label: "New Arrivals" });

    chips.innerHTML = tags
      .map(
        (t) => `
      <span class="active-chip" data-key="${t.key}" data-value="${safeText(String(t.value))}">
        ${safeText(t.label)}
        <button type="button" class="chip-x" data-key="${t.key}" data-value="${safeText(String(t.value))}"><i class="fa-solid fa-xmark"></i></button>
      </span>
    `,
      )
      .join("");

    // Show/hide active filters bar
    if (activeFiltersBar) {
      activeFiltersBar.hidden = tags.length === 0;
    }
  }

  function updateFilterCount() {
    const countEl = $("#activeFilterCount");
    if (!countEl) return;

    let count = 0;
    count += activeFilters.category.length;
    count += activeFilters.gender.length;
    if (activeFilters.priceRange) count++;
    count += activeFilters.deliveryType.length;
    if (activeFilters.inStockOnly) count++;
    if (activeFilters.newArrivalsOnly) count++;

    countEl.textContent = String(count);
    countEl.hidden = count === 0;
  }

  function clearFilter(key, value) {
    if (key === "inStockOnly") {
      activeFilters.inStockOnly = false;
      const checkbox = $("#filterInStock");
      if (checkbox) checkbox.checked = false;
    } else if (key === "newArrivalsOnly") {
      activeFilters.newArrivalsOnly = false;
      const checkbox = $("#filterNewArrivals");
      if (checkbox) checkbox.checked = false;
    } else if (key === "priceRange") {
      activeFilters.priceRange = "";
      // Reset price sliders
      const priceMinSlider = $("#priceMinSlider");
      const priceMaxSlider = $("#priceMaxSlider");
      const priceMinInput = $("#priceMinInput");
      const priceMaxInput = $("#priceMaxInput");
      const priceMinDisplay = $("#priceMinDisplay");
      const priceMaxDisplay = $("#priceMaxDisplay");
      if (priceMinSlider) priceMinSlider.value = 0;
      if (priceMaxSlider) priceMaxSlider.value = 500000;
      if (priceMinInput) priceMinInput.value = 0;
      if (priceMaxInput) priceMaxInput.value = 500000;
      if (priceMinDisplay) priceMinDisplay.textContent = "₦0";
      if (priceMaxDisplay) priceMaxDisplay.textContent = "₦500,000";
    } else if (Array.isArray(activeFilters[key])) {
      // Remove specific value from array
      activeFilters[key] = activeFilters[key].filter((v) => v !== value);
      // Uncheck specific checkbox
      const checkbox = document.querySelector(
        `[data-filter-key="${key}"] input[value="${value}"]`,
      );
      if (checkbox) checkbox.checked = false;
    } else {
      activeFilters[key] = "";
      // Uncheck sidebar checkboxes
      $$(`[data-filter-key="${key}"] input[type="checkbox"]`).forEach((cb) => {
        cb.checked = false;
      });
    }
    applyFilters();
  }

  function resetAllFilters() {
    activeFilters = {
      category: [],
      gender: [],
      priceRange: "",
      deliveryType: [],
      inStockOnly: false,
      newArrivalsOnly: false,
    };
    // Uncheck all checkboxes in sidebar
    $$(".shop-sidebar input[type='checkbox']").forEach((cb) => {
      cb.checked = false;
    });
    // Reset price sliders
    const priceMinSlider = $("#priceMinSlider");
    const priceMaxSlider = $("#priceMaxSlider");
    const priceMinInput = $("#priceMinInput");
    const priceMaxInput = $("#priceMaxInput");
    const priceMinDisplay = $("#priceMinDisplay");
    const priceMaxDisplay = $("#priceMaxDisplay");
    if (priceMinSlider) priceMinSlider.value = 0;
    if (priceMaxSlider) priceMaxSlider.value = 500000;
    if (priceMinInput) priceMinInput.value = 0;
    if (priceMaxInput) priceMaxInput.value = 500000;
    if (priceMinDisplay) priceMinDisplay.textContent = "₦0";
    if (priceMaxDisplay) priceMaxDisplay.textContent = "₦500,000";

    if (searchInput) searchInput.value = "";
    applyFilters();
  }

  // URL Params
  function applyURLParams() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    if (cat) activeFilters.category = [cat];
    const gen = params.get("gender");
    if (gen) activeFilters.gender = [gen];
    const q = params.get("search") || params.get("q");
    if (q && searchInput) searchInput.value = q;
  }

  // Modal
  async function openModal(productOrId) {
    if (!productModal) return;

    let product = productOrId;

    // If passed a productId (string/number), fetch the product
    if (typeof productOrId === "string" || typeof productOrId === "number") {
      const client = window.supabaseClient || window.DB?.client;
      if (!client) {
        console.error("SHOP: No database client for fetching product");
        return;
      }
      const { data, error } = await client
        .from("products")
        .select("*")
        .eq("id", productOrId)
        .maybeSingle();
      if (error || !data) {
        console.error("SHOP: Failed to fetch product:", error);
        return;
      }
      product = data;
    }

    if (!product) return;
    modalProduct = product;

    // Check for edit mode
    const editRaw = sessionStorage.getItem("LBS_EDIT_ITEM");
    let editItem = null;
    if (editRaw) {
      try {
        editItem = JSON.parse(editRaw);
      } catch (_) {}
      sessionStorage.removeItem("LBS_EDIT_ITEM");
    }

    modalSelectedSize = editItem?.selectedSize || "";
    modalSelectedColor = editItem?.selectedColor || "";
    modalQty = editItem?.qty || 1;
    modalEditIdx = editItem ? editItem.idx : null;
    currentImageIndex = 0;

    modalImages = parseArray(product.images);
    if (!modalImages.length)
      modalImages = [
        "https://placehold.co/400x500/f8fafc/be185d?text=No+Image",
      ];

    const inStock = (product.qty || 0) > 0;
    const productStock = product.qty || 0;
    const sizesRaw = product.sizes?.length ? product.sizes : [];
    // Handle both old format (string array) and new format (object array with qty)
    const sizes = sizesRaw.map((s) =>
      typeof s === "string" ? { name: s, qty: productStock } : s,
    );
    const colorsRaw = product.colors || [];
    // Handle both old format (string array) and new format (object array)
    const colors = colorsRaw.map((c) =>
      typeof c === "string" ? { name: c, qty: 1 } : c,
    );
    const showColors = product.allow_color_selection && colors.length > 0;
    const packType = product.pack_type || "";
    const isExpress = product.delivery_type === "express";
    const deliveryType = isExpress ? "Same-day" : "Standard";
    const description = safeText(
      product.description || "No description available.",
    );
    const reviewCount = product.review_count || 0;

    // Share URL
    const shareUrl = encodeURIComponent(
      window.location.origin + "/shop?product=" + product.id,
    );
    const shareText = encodeURIComponent(
      product.name + " - Lingerie by Sisioyin",
    );

    productModal.innerHTML = `
      <div class="quick-modal">
        <button type="button" class="qm-close" id="qmClose"><i class="fa-solid fa-xmark"></i></button>
        <div class="qm-body">
          <div class="qm-gallery">
            <div class="qm-main-img" id="qmMainWrap">
              ${modalImages.length > 1 ? '<button class="qm-arr left" id="qmPrev"><i class="fa-solid fa-chevron-left"></i></button>' : ""}
              <img src="${modalImages[0]}" alt="${safeText(product.name)}" id="qmMainImg" />
              ${modalImages.length > 1 ? '<button class="qm-arr right" id="qmNext"><i class="fa-solid fa-chevron-right"></i></button>' : ""}
            </div>
            ${
              modalImages.length > 1
                ? `
            <div class="qm-thumbs" id="qmThumbs">
              ${modalImages.map((img, i) => `<button class="qm-thumb${i === 0 ? " active" : ""}" data-idx="${i}"><img src="${img}" /></button>`).join("")}
            </div>
            `
                : ""
            }
          </div>
          <div class="qm-details">
            <div class="qm-meta">
              <span class="qm-cat">${safeText(product.category)}</span>
            </div>
            <h2 class="qm-title">${safeText(product.name)}</h2>
            <p class="qm-desc">${description}</p>
            <div class="qm-review">${reviewCount > 0 ? `<i class="fa-solid fa-star"></i> ${reviewCount} reviews` : '<i class="fa-regular fa-star"></i> No reviews yet'}</div>
            
            <div class="qm-price-stock">
              <span class="qm-price">${formatPrice(product.price_ngn)}</span>
              <span class="qm-stock ${inStock ? "in" : "out"}">${inStock ? "30 in stock" : "Sold Out"}</span>
              <span class="qm-delivery-tag ${isExpress ? "express" : ""}"><i class="fa-solid ${isExpress ? "fa-bolt" : "fa-truck"}"></i> ${deliveryType}</span>
            </div>

            ${
              sizes.length
                ? `
            <div class="qm-section">
              <span class="qm-label">Size <a href="/size" class="qm-guide">Size Guide</a></span>
              <div class="qm-sizes" id="qmSizes">
                ${sizes
                  .map((s) => {
                    const sizeName = s.name;
                    const sizeQty = s.qty || 0;
                    const isSizeInStock = sizeQty > 0;
                    return `<button class="qm-size${!isSizeInStock ? " out-of-stock" : ""}" data-size="${safeText(sizeName)}" data-qty="${sizeQty}" ${!isSizeInStock ? "disabled" : ""}>${safeText(sizeName)}</button>`;
                  })
                  .join("")}
              </div>
            </div>
            `
                : ""
            }

            ${
              showColors
                ? `
            <div class="qm-section">
              <span class="qm-label">Color</span>
              <div class="qm-colors" id="qmColors">
                ${colors
                  .map((c, i) => {
                    const colorName = c.name;
                    const colorValue = getColorValue(colorName);
                    const colorQty = c.qty || 0;
                    const isColorInStock = colorQty > 0;
                    return `<button class="qm-color${!isColorInStock ? " out-of-stock" : ""}" data-color="${safeText(colorName)}" data-qty="${colorQty}" data-tooltip="${safeText(colorName)}${!isColorInStock ? " (Out of Stock)" : ""}" style="background:${safeText(colorValue)}" ${!isColorInStock ? "disabled" : ""}><span class="qm-color-name">${safeText(colorName)}</span></button>`;
                  })
                  .join("")}
              </div>
            </div>
            `
                : !product.allow_color_selection && packType
                  ? `
            <div class="qm-section">
              <span class="qm-label">Pack</span>
              <span class="qm-pack">${safeText(packType)} (Assorted)</span>
            </div>
            `
                  : ""
            }

            <div class="qm-section">
              <span class="qm-label">Quantity</span>
              <div class="qm-qty-row">
                <div class="qm-qty">
                  <button id="qmQtyMinus"><i class="fa-solid fa-minus"></i></button>
                  <input type="number" id="qmQtyInput" value="${modalQty}" min="1" max="99" />
                  <button id="qmQtyPlus"><i class="fa-solid fa-plus"></i></button>
                </div>
              </div>
            </div>

            <div class="qm-actions">
              <button class="qm-add-cart" id="qmAddCart" ${!inStock ? "disabled" : ""}><i class="fa-solid fa-bag-shopping"></i> ${editItem ? "Update Cart" : "Add to Cart"}</button>
              <button class="qm-wish" id="qmWish"><i class="fa-regular fa-heart"></i></button>
            </div>

            <div class="qm-share">
              <span class="qm-share-label">Share</span>
              <div class="qm-share-icons">
                <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" class="qm-share-btn facebook" title="Share on Facebook"><i class="fa-brands fa-facebook-f"></i></a>
                <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener" class="qm-share-btn twitter" title="Share on X"><i class="fa-brands fa-x-twitter"></i></a>
                <a href="https://www.instagram.com" target="_blank" rel="noopener" class="qm-share-btn instagram" title="Share on Instagram"><i class="fa-brands fa-instagram"></i></a>
                <a href="https://www.tiktok.com" target="_blank" rel="noopener" class="qm-share-btn tiktok" title="Share on TikTok"><i class="fa-brands fa-tiktok"></i></a>
                <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener" class="qm-share-btn whatsapp" title="Share on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
                <button type="button" class="qm-share-btn copy" id="qmCopyLink" title="Copy Link"><i class="fa-solid fa-link"></i></button>
              </div>
            </div>

            <!-- Reviews Section -->
            <div class="qm-reviews-section" id="qmReviews">
              <div class="qm-reviews-header">
                <h3 class="qm-reviews-title"><i class="fa-solid fa-star"></i> Customer Reviews</h3>
                <button type="button" class="qm-write-review-btn" id="qmWriteReviewBtn" hidden>Write a Review</button>
              </div>
              <div class="qm-reviews-summary" id="qmReviewsSummary"></div>
              <div class="qm-reviews-list" id="qmReviewsList">
                <p class="qm-reviews-loading">Loading reviews...</p>
              </div>
            </div>

            <!-- Review Form (hidden by default, only for verified purchasers from dashboard) -->
            <div class="qm-review-form" id="qmReviewForm" hidden>
              <h4>Write a Review</h4>
              <div class="qm-star-picker" id="qmStarPicker">
                ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="qm-star-btn" data-star="${n}" aria-label="${n} star"><i class="fa-regular fa-star"></i></button>`).join("")}
              </div>
              <input type="text" id="qmReviewName" placeholder="Your name" maxlength="100" class="qm-review-input" />
              <input type="email" id="qmReviewEmail" placeholder="Email (optional)" maxlength="200" class="qm-review-input" />
              <input type="text" id="qmReviewTitle" placeholder="Review title (optional)" maxlength="150" class="qm-review-input" />
              <textarea id="qmReviewComment" placeholder="Share your experience..." rows="3" maxlength="1000" class="qm-review-input"></textarea>
              <div class="qm-review-form-actions">
                <button type="button" class="qm-submit-review" id="qmSubmitReview">Submit Review</button>
                <button type="button" class="qm-cancel-review" id="qmCancelReview">Cancel</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    if (showColors && colors.length && !editItem) {
      // No pre-selection — user must choose a color
      modalSelectedColor = "";
    }
    productModal.hidden = false;
    document.body.style.overflow = "hidden";
    setupModalEvents();

    // Pre-select size/color in edit mode
    if (editItem) {
      if (modalSelectedSize) {
        const sizeBtn = productModal.querySelector(
          `.qm-size[data-size="${modalSelectedSize}"]`,
        );
        if (sizeBtn) {
          productModal
            .querySelectorAll(".qm-size")
            .forEach((s) => s.classList.remove("active"));
          sizeBtn.classList.add("active");
        }
      }
      if (modalSelectedColor) {
        const colorBtn = productModal.querySelector(
          `.qm-color[data-color="${modalSelectedColor}"]`,
        );
        if (colorBtn) {
          productModal
            .querySelectorAll(".qm-color")
            .forEach((c) => c.classList.remove("active"));
          colorBtn.classList.add("active");
        }
      }
    }

    loadProductReviews(product.id);
    checkCanReview(product.id);
  }

  // Check if user has received this product (delivered order) — only then show Write a Review
  async function checkCanReview(productId) {
    const btn = $("#qmWriteReviewBtn");
    if (!btn) return;
    btn.hidden = true;
    try {
      const c = window.supabaseClient || window.DB?.client;
      if (!c) return;
      const {
        data: { user },
      } = await c.auth.getUser();
      if (!user?.email) return;
      const { data: orders } = await c
        .from("orders")
        .select("items")
        .eq("customer_email", user.email)
        .eq("status", "delivered");
      const hasPurchased = orders?.some(
        (o) =>
          Array.isArray(o.items) &&
          o.items.some((item) => String(item.id) === String(productId)),
      );
      if (hasPurchased) btn.hidden = false;
    } catch (_) {
      /* silently fail */
    }
  }

  // ── Review Functions ──────────────────────────
  async function loadProductReviews(productId) {
    const listEl = $("#qmReviewsList");
    const summaryEl = $("#qmReviewsSummary");
    if (!listEl) return;

    try {
      const c = window.supabaseClient;
      if (!c) {
        listEl.innerHTML = '<p class="qm-no-reviews">Reviews unavailable</p>';
        return;
      }

      const { data: reviews, error } = await c
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Summary
      if (summaryEl && reviews?.length) {
        const avg = (
          reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        ).toFixed(1);
        const stars = renderStars(Math.round(avg));
        summaryEl.innerHTML = `<span class="qm-avg-rating">${avg}</span> ${stars} <span class="qm-review-count">(${reviews.length} review${reviews.length !== 1 ? "s" : ""})</span>`;
      } else if (summaryEl) {
        summaryEl.innerHTML = "";
      }

      // List
      if (!reviews?.length) {
        listEl.innerHTML =
          '<p class="qm-no-reviews">No reviews yet. Be the first!</p>';
        return;
      }

      listEl.innerHTML = reviews
        .map((r) => {
          const date = new Date(r.created_at).toLocaleDateString("en-NG", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          return `
          <div class="qm-review-item">
            <div class="qm-review-item-header">
              <span class="qm-review-author">${safeText(r.customer_name)}</span>
              <span class="qm-review-date">${date}</span>
            </div>
            <div class="qm-review-stars">${renderStars(r.rating)}</div>
            ${r.title ? `<strong class="qm-review-item-title">${safeText(r.title)}</strong>` : ""}
            <p class="qm-review-text">${safeText(r.comment)}</p>
          </div>`;
        })
        .join("");
    } catch (err) {
      console.error("Failed to load reviews:", err);
      listEl.innerHTML = '<p class="qm-no-reviews">Could not load reviews</p>';
    }
  }

  function renderStars(count) {
    return Array.from(
      { length: 5 },
      (_, i) => `<i class="fa-${i < count ? "solid" : "regular"} fa-star"></i>`,
    ).join("");
  }

  async function submitReview(productId) {
    const name = $("#qmReviewName")?.value?.trim();
    const email = $("#qmReviewEmail")?.value?.trim();
    const title = $("#qmReviewTitle")?.value?.trim();
    const comment = $("#qmReviewComment")?.value?.trim();
    const stars =
      productModal?.querySelectorAll(".qm-star-btn.active")?.length || 0;

    if (!name) {
      toast("Please enter your name", "warning");
      return;
    }
    if (!comment) {
      toast("Please write a comment", "warning");
      return;
    }
    if (!stars) {
      toast("Please select a star rating", "warning");
      return;
    }

    const btn = $("#qmSubmitReview");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting...";
    }

    try {
      const c = window.supabaseClient;
      if (!c) throw new Error("Not connected");

      const { error } = await c.from("reviews").insert({
        product_id: productId,
        customer_name: name,
        customer_email: email || null,
        rating: stars,
        title: title || null,
        comment: comment,
      });

      if (error) throw error;

      toast("Review submitted! It will appear after approval.", "success");
      const form = $("#qmReviewForm");
      if (form) form.hidden = true;
      // Refresh reviews list
      await loadProductReviews(productId);
    } catch (err) {
      console.error("Review submit error:", err);
      toast("Failed to submit review. Please try again.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit Review";
      }
    }
  }

  function closeModal() {
    if (!productModal) return;
    productModal.hidden = true;
    document.body.style.overflow = "";
    modalProduct = null;
  }

  function setupModalEvents() {
    const close = $("#qmClose");
    const prev = $("#qmPrev");
    const next = $("#qmNext");
    const thumbs = $("#qmThumbs");
    const mainImg = $("#qmMainImg");
    const mainWrap = $("#qmMainWrap");
    const sizes = $("#qmSizes");
    const colors = $("#qmColors");
    const qtyM = $("#qmQtyMinus");
    const qtyP = $("#qmQtyPlus");
    const qtyI = $("#qmQtyInput");
    const addCart = $("#qmAddCart");
    const wish = $("#qmWish");
    const copyLink = $("#qmCopyLink");

    close?.addEventListener("click", closeModal);

    const updateImage = () => {
      if (mainImg) mainImg.src = modalImages[currentImageIndex];
      thumbs
        ?.querySelectorAll(".qm-thumb")
        .forEach((t, i) =>
          t.classList.toggle("active", i === currentImageIndex),
        );
    };

    prev?.addEventListener("click", () => {
      currentImageIndex =
        (currentImageIndex - 1 + modalImages.length) % modalImages.length;
      updateImage();
    });
    next?.addEventListener("click", () => {
      currentImageIndex = (currentImageIndex + 1) % modalImages.length;
      updateImage();
    });
    thumbs?.addEventListener("click", (e) => {
      const t = e.target.closest(".qm-thumb");
      if (t) {
        currentImageIndex = parseInt(t.dataset.idx, 10);
        updateImage();
      }
    });

    // Double-click to preview with slider
    mainWrap?.addEventListener("dblclick", () =>
      openImagePreview(currentImageIndex),
    );

    // Helper to get current max quantity based on selection
    function getMaxQuantity() {
      if (!modalProduct) return 99;

      // If BOTH size and color are selected, check variant_stock first
      if (modalSelectedSize && modalSelectedColor) {
        const variantStock = modalProduct.variant_stock || [];
        const variant = variantStock.find(
          (v) => v.size === modalSelectedSize && v.color === modalSelectedColor,
        );
        if (variant) {
          return variant.qty || 0;
        }
      }

      // If color is selected, use that color's qty
      if (modalSelectedColor) {
        const colorsRaw = modalProduct.colors || [];
        const colorObj = colorsRaw.find(
          (c) => (typeof c === "string" ? c : c.name) === modalSelectedColor,
        );
        if (
          colorObj &&
          typeof colorObj === "object" &&
          colorObj.qty !== undefined
        ) {
          return colorObj.qty || 0;
        }
      }

      // If size is selected, check size qty
      if (modalSelectedSize) {
        const sizesRaw = modalProduct.sizes || [];
        const sizeObj = sizesRaw.find(
          (s) => (typeof s === "string" ? s : s.name) === modalSelectedSize,
        );
        if (
          sizeObj &&
          typeof sizeObj === "object" &&
          sizeObj.qty !== undefined
        ) {
          return sizeObj.qty || 0;
        }
      }

      // Default to product qty
      return modalProduct.qty || 0;
    }

    function updateQuantityMax() {
      const maxQty = getMaxQuantity();
      if (qtyI) qtyI.max = maxQty;
      if (modalQty > maxQty) {
        modalQty = Math.max(1, maxQty);
        if (qtyI) qtyI.value = modalQty;
      }
    }

    // Update visual availability of sizes/colors based on variant_stock
    function updateVariantAvailability() {
      if (!modalProduct) return;
      const variantStock = modalProduct.variant_stock || [];
      if (!variantStock.length) return; // No variant matrix, use individual stock

      // If a color is selected, update which sizes are available for that color
      if (modalSelectedColor && sizes) {
        sizes.querySelectorAll(".qm-size").forEach((btn) => {
          const sizeName = btn.dataset.size;
          const variant = variantStock.find(
            (v) => v.size === sizeName && v.color === modalSelectedColor,
          );
          const hasStock = variant && variant.qty > 0;
          btn.classList.toggle("variant-out-of-stock", !hasStock);
        });
      } else if (sizes) {
        // No color selected, show all sizes as available (based on their base stock)
        sizes.querySelectorAll(".qm-size").forEach((btn) => {
          btn.classList.remove("variant-out-of-stock");
        });
      }

      // If a size is selected, update which colors are available for that size
      if (modalSelectedSize && colors) {
        colors.querySelectorAll(".qm-color").forEach((btn) => {
          const colorName = btn.dataset.color;
          const variant = variantStock.find(
            (v) => v.size === modalSelectedSize && v.color === colorName,
          );
          const hasStock = variant && variant.qty > 0;
          btn.classList.toggle("variant-out-of-stock", !hasStock);
        });
      } else if (colors) {
        // No size selected, show all colors as available (based on their base stock)
        colors.querySelectorAll(".qm-color").forEach((btn) => {
          btn.classList.remove("variant-out-of-stock");
        });
      }
    }

    // Size selection with toggle (click again to unselect)
    sizes?.addEventListener("click", (e) => {
      const b = e.target.closest(".qm-size");
      if (
        !b ||
        b.classList.contains("out-of-stock") ||
        b.classList.contains("variant-out-of-stock")
      )
        return;

      // If already active, toggle off
      if (b.classList.contains("active")) {
        b.classList.remove("active");
        modalSelectedSize = "";
      } else {
        sizes
          .querySelectorAll(".qm-size")
          .forEach((s) => s.classList.remove("active"));
        b.classList.add("active");
        modalSelectedSize = b.dataset.size;
      }
      updateVariantAvailability();
      updateQuantityMax();
    });

    colors?.addEventListener("click", (e) => {
      const b = e.target.closest(".qm-color");
      if (
        !b ||
        b.classList.contains("out-of-stock") ||
        b.classList.contains("variant-out-of-stock")
      )
        return;
      const wasActive = b.classList.contains("active");
      colors
        .querySelectorAll(".qm-color")
        .forEach((c) => c.classList.remove("active"));
      if (wasActive) {
        modalSelectedColor = null;
      } else {
        b.classList.add("active");
        modalSelectedColor = b.dataset.color;
      }
      updateVariantAvailability();
      updateQuantityMax();
    });

    qtyM?.addEventListener("click", () => {
      modalQty = Math.max(1, modalQty - 1);
      if (qtyI) qtyI.value = modalQty;
    });
    qtyP?.addEventListener("click", () => {
      const maxQty = getMaxQuantity();
      modalQty = Math.min(maxQty, modalQty + 1);
      if (qtyI) qtyI.value = modalQty;
    });
    qtyI?.addEventListener("change", () => {
      const maxQty = getMaxQuantity();
      modalQty = Math.max(1, Math.min(maxQty, parseInt(qtyI.value, 10) || 1));
      qtyI.value = modalQty;
    });

    addCart?.addEventListener("click", () => {
      if (!modalProduct) return;
      const productSizes = modalProduct.sizes || [];
      if (productSizes.length > 0 && !modalSelectedSize) {
        toast("Please select a size", "warning");
        return;
      }
      const item = {
        variantId: `${modalProduct.id}-${modalSelectedSize || "default"}${modalSelectedColor ? `-${modalSelectedColor}` : ""}`,
        id: modalProduct.id,
        name: modalProduct.name,
        price_ngn: modalProduct.price_ngn,
        selectedSize: modalSelectedSize || "One Size",
        selectedColor: modalSelectedColor,
        image: getFirstImage(modalProduct.images),
        qty: modalQty,
      };

      if (modalEditIdx !== null) {
        // Update mode — replace item at the stored index
        const cart = JSON.parse(localStorage.getItem("LBS_CART_V1") || "[]");
        if (cart[modalEditIdx]) {
          cart[modalEditIdx] = item;
          localStorage.setItem("LBS_CART_V1", JSON.stringify(cart));
          window.dispatchEvent(new Event("cartUpdated"));
          toast("Cart updated!", "success");
        }
        modalEditIdx = null;
      } else {
        window.APP?.addToCart?.(item);
      }
      closeModal();
      openCartDrawer();
    });

    wish?.addEventListener("click", () => {
      if (modalProduct) toggleWishlist(modalProduct.id, wish);
    });

    // Copy link functionality
    copyLink?.addEventListener("click", async () => {
      const url = window.location.origin + "/shop?product=" + modalProduct?.id;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          toast("Link copied!", "success");
        } else {
          // Fallback for non-secure contexts (mobile browsers)
          const textArea = document.createElement("textarea");
          textArea.value = url;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          textArea.style.top = "-9999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const success = document.execCommand("copy");
          document.body.removeChild(textArea);
          if (success) {
            toast("Link copied!", "success");
          } else {
            toast("Failed to copy link", "error");
          }
        }
      } catch {
        toast("Failed to copy link", "error");
      }
    });

    // ── Review events ──
    const writeBtn = $("#qmWriteReviewBtn");
    const reviewForm = $("#qmReviewForm");
    const cancelReview = $("#qmCancelReview");
    const submitReview$ = $("#qmSubmitReview");
    const starPicker = $("#qmStarPicker");
    let selectedStars = 0;

    writeBtn?.addEventListener("click", async () => {
      // ── Purchase verification: only verified buyers can review ──
      const c = window.supabaseClient || window.DB?.client;
      if (!c) {
        toast("Please log in to write a review", "warning");
        window.APP?.toggleAuth?.();
        return;
      }

      const {
        data: { user },
      } = await c.auth.getUser();
      if (!user?.email) {
        toast("Please log in to write a review", "warning");
        window.APP?.toggleAuth?.();
        return;
      }

      try {
        writeBtn.disabled = true;
        writeBtn.textContent = "Verifying purchase...";
        const { data: orders, error } = await c
          .from("orders")
          .select("items")
          .eq("customer_email", user.email)
          .in("status", ["delivered", "shipped", "processing", "confirmed"]);

        if (error) throw error;

        const hasPurchased = orders?.some(
          (o) =>
            Array.isArray(o.items) &&
            o.items.some(
              (item) => String(item.id) === String(modalProduct?.id),
            ),
        );

        if (!hasPurchased) {
          toast("Only verified purchasers can write reviews", "warning");
          return;
        }
      } catch (err) {
        console.error("Purchase check error:", err);
        // On error, still allow (admin approval required anyway)
      } finally {
        writeBtn.disabled = false;
        writeBtn.textContent = "Write a Review";
      }

      if (reviewForm) reviewForm.hidden = false;
      writeBtn.style.display = "none";
      reviewForm?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    cancelReview?.addEventListener("click", () => {
      if (reviewForm) reviewForm.hidden = true;
      if (writeBtn) writeBtn.style.display = "";
      selectedStars = 0;
      starPicker?.querySelectorAll(".qm-star-btn").forEach((b) => {
        b.classList.remove("active");
        b.innerHTML = '<i class="fa-regular fa-star"></i>';
      });
    });

    starPicker?.addEventListener("click", (e) => {
      const btn = e.target.closest(".qm-star-btn");
      if (!btn) return;
      selectedStars = parseInt(btn.dataset.star, 10);
      starPicker.querySelectorAll(".qm-star-btn").forEach((b) => {
        const s = parseInt(b.dataset.star, 10);
        const filled = s <= selectedStars;
        b.classList.toggle("active", filled);
        b.innerHTML = `<i class="fa-${filled ? "solid" : "regular"} fa-star"></i>`;
      });
    });

    starPicker?.addEventListener("mouseover", (e) => {
      const btn = e.target.closest(".qm-star-btn");
      if (!btn) return;
      const hoverStar = parseInt(btn.dataset.star, 10);
      starPicker.querySelectorAll(".qm-star-btn").forEach((b) => {
        const s = parseInt(b.dataset.star, 10);
        b.innerHTML = `<i class="fa-${s <= hoverStar ? "solid" : "regular"} fa-star"></i>`;
      });
    });

    starPicker?.addEventListener("mouseleave", () => {
      starPicker.querySelectorAll(".qm-star-btn").forEach((b) => {
        const s = parseInt(b.dataset.star, 10);
        b.innerHTML = `<i class="fa-${s <= selectedStars ? "solid" : "regular"} fa-star"></i>`;
      });
    });

    submitReview$?.addEventListener("click", () => {
      if (modalProduct) submitReview(modalProduct.id);
    });
  }

  // Image Preview with Slider
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
          a.download = `${modalProduct?.name || "image"}-${idx + 1}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
          toast("Downloaded!", "success");
        } catch {
          toast("Download failed", "error");
        }
      }
    });

    // Keyboard navigation
    const keyHandler = (e) => {
      if (e.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", keyHandler);
      }
      if (e.key === "ArrowLeft") {
        idx = (idx - 1 + modalImages.length) % modalImages.length;
        render();
      }
      if (e.key === "ArrowRight") {
        idx = (idx + 1) % modalImages.length;
        render();
      }
    };
    document.addEventListener("keydown", keyHandler);
  }

  // Quick add to cart from card
  function quickAddToCart(productId) {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;

    if (product.sizes?.length > 0) {
      openModal(product);
      return;
    }

    const item = {
      variantId: `${product.id}-default`,
      id: product.id,
      name: product.name,
      price_ngn: product.price_ngn,
      selectedSize: "One Size",
      selectedColor: "",
      image: getFirstImage(product.images),
      qty: 1,
    };
    window.APP?.addToCart?.(item);
    toast("Added to cart!", "success");
    openCartDrawer();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CART DRAWER
  // ═══════════════════════════════════════════════════════════════════════

  const cartDrawer = $("#cartDrawer");
  const cartDrawerOverlay = $("#cartDrawerOverlay");
  const cartDrawerBody = $("#cartDrawerBody");
  const cartDrawerFooter = $("#cartDrawerFooter");
  const closeCartDrawerBtn = $("#closeCartDrawer");

  function openCartDrawer() {
    renderCartDrawer();
    cartDrawer?.classList.add("open");
    cartDrawerOverlay?.classList.add("open");
    document.body.style.overflow = "hidden";
    document.body.classList.add("drawer-open");
  }

  function closeCartDrawer() {
    cartDrawer?.classList.remove("open");
    cartDrawerOverlay?.classList.remove("open");
    document.body.style.overflow = "";
    document.body.classList.remove("drawer-open");
  }

  function renderCartDrawer() {
    const cart = JSON.parse(localStorage.getItem("LBS_CART_V1") || "[]");
    const cartEmpty = $("#cartEmpty");

    if (!cart.length) {
      if (cartEmpty) cartEmpty.style.display = "flex";
      if (cartDrawerFooter) cartDrawerFooter.style.display = "none";
      // Remove any existing items
      cartDrawerBody?.querySelectorAll(".cd-item").forEach((el) => el.remove());
      return;
    }

    if (cartEmpty) cartEmpty.style.display = "none";
    if (cartDrawerFooter) cartDrawerFooter.style.display = "block";

    // Remove existing items
    cartDrawerBody?.querySelectorAll(".cd-item").forEach((el) => el.remove());

    let subtotal = 0;
    cart.forEach((item, idx) => {
      subtotal += (item.price_ngn || 0) * (item.qty || 1);

      // Get color for the dot
      const colorName = item.selectedColor || "";
      const colorHex = getColorHex(colorName);

      const itemEl = document.createElement("div");
      itemEl.className = "cd-item";
      itemEl.innerHTML = `
        <img src="${item.image || "https://placehold.co/72x90/f8fafc/be185d?text=No+Image"}" alt="${safeText(item.name)}" class="cd-item-img">
        <div class="cd-item-info">
          <h4 class="cd-item-name">${safeText(item.name)}</h4>
          <div class="cd-item-variant">
            ${item.selectedSize ? `<span class="cd-variant-tag">${item.selectedSize}</span>` : ""}
            ${colorName ? `<span class="cd-variant-tag"><span class="cd-color-dot" style="background:${colorHex}"></span>${colorName}</span>` : ""}
          </div>
          <div class="cd-item-bottom">
            <p class="cd-item-price">${formatPrice(item.price_ngn)}</p>
            <div class="cd-item-qty">
              <button type="button" class="cd-qty-btn cd-qty-minus" data-idx="${idx}"><i class="fa-solid fa-minus"></i></button>
              <span class="cd-qty-value">${item.qty || 1}</span>
              <button type="button" class="cd-qty-btn cd-qty-plus" data-idx="${idx}"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
          <div class="cd-item-actions">
            <button type="button" class="cd-item-edit" data-idx="${idx}" data-product-id="${item.id || ""}" aria-label="Edit item" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
            <button type="button" class="cd-item-remove" data-idx="${idx}" aria-label="Remove item" title="Remove"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>
      `;
      cartDrawerBody?.insertBefore(itemEl, cartEmpty);
    });

    const subtotalEl = $("#cartSubtotal");
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  }

  function updateCartItemQty(idx, delta) {
    const cart = JSON.parse(localStorage.getItem("LBS_CART_V1") || "[]");
    if (!cart[idx]) return;

    cart[idx].qty = Math.max(1, Math.min(99, (cart[idx].qty || 1) + delta));
    localStorage.setItem("LBS_CART_V1", JSON.stringify(cart));
    window.APP?.updateCartCount?.();
    renderCartDrawer();
  }

  function removeCartItem(idx) {
    const cart = JSON.parse(localStorage.getItem("LBS_CART_V1") || "[]");
    cart.splice(idx, 1);
    localStorage.setItem("LBS_CART_V1", JSON.stringify(cart));
    window.APP?.updateCartCount?.();
    renderCartDrawer();
    toast("Item removed", "info");
  }

  // Cart drawer event listeners
  closeCartDrawerBtn?.addEventListener("click", closeCartDrawer);

  // Prevent clicks inside drawer from closing it
  cartDrawer?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Close when clicking on overlay (the background, not the drawer)
  cartDrawerOverlay?.addEventListener("click", (e) => {
    closeCartDrawer();
  });

  // Continue shopping button
  const continueShoppingBtn = $("#continueShoppingBtn");
  continueShoppingBtn?.addEventListener("click", closeCartDrawer);

  cartDrawerBody?.addEventListener("click", (e) => {
    const minusBtn = e.target.closest(".cd-qty-minus");
    const plusBtn = e.target.closest(".cd-qty-plus");
    const removeBtn = e.target.closest(".cd-item-remove");
    const editBtn = e.target.closest(".cd-item-edit");

    if (minusBtn) {
      updateCartItemQty(parseInt(minusBtn.dataset.idx, 10), -1);
    } else if (plusBtn) {
      updateCartItemQty(parseInt(plusBtn.dataset.idx, 10), 1);
    } else if (removeBtn) {
      removeCartItem(parseInt(removeBtn.dataset.idx, 10));
    } else if (editBtn) {
      const idx = parseInt(editBtn.dataset.idx, 10);
      const cart = JSON.parse(localStorage.getItem("LBS_CART_V1") || "[]");
      const item = cart[idx];
      if (!item) return;
      // Store edit info so openModal can pre-fill
      sessionStorage.setItem("LBS_EDIT_ITEM", JSON.stringify({ idx, ...item }));
      closeCartDrawer();
      const productId = editBtn.dataset.productId || item.id;
      if (productId) {
        openModal(productId);
      }
    }
  });

  // Listen for cart icon clicks from header
  document.addEventListener("click", (e) => {
    if (
      e.target.closest(
        "#cartIcon, .cart-icon, [data-cart-toggle], [data-cart-drawer]",
      )
    ) {
      e.preventDefault();
      openCartDrawer();
    }
  });

  function toggleWishlist(id, btn) {
    const wishlist = JSON.parse(localStorage.getItem("LBS_WISHLIST") || "[]");
    const idx = wishlist.indexOf(String(id));
    if (idx > -1) {
      wishlist.splice(idx, 1);
      btn?.classList.remove("active");
      if (btn) {
        btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
        btn.dataset.tooltip = "Add to Wishlist";
      }
      toast("Removed from wishlist", "info");
    } else {
      wishlist.push(String(id));
      btn?.classList.add("active");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
        btn.dataset.tooltip = "Remove from Wishlist";
      }
      toast("Added to wishlist", "success");
    }
    localStorage.setItem("LBS_WISHLIST", JSON.stringify(wishlist));
    window.dispatchEvent(new CustomEvent("wishlist:updated"));
  }

  // Event Listeners
  function setupEvents() {
    // Sidebar filter checkboxes
    const shopSidebar = $("#shopSidebar");
    const sidebarOverlay = $("#sidebarOverlay");
    const filterToggleBtn = $("#filterToggleBtn");

    // Toggle sidebar on mobile
    filterToggleBtn?.addEventListener("click", () => {
      shopSidebar?.classList.add("open");
      sidebarOverlay?.classList.add("active");
      document.body.style.overflow = "hidden";
    });

    // Close sidebar
    sidebarOverlay?.addEventListener("click", () => {
      shopSidebar?.classList.remove("open");
      sidebarOverlay?.classList.remove("active");
      document.body.style.overflow = "";
    });

    // Sidebar checkbox filters
    shopSidebar?.addEventListener("change", (e) => {
      // Ignore change events during initialization (browser form restoration)
      if (isInitializing) return;

      const checkbox = e.target.closest("input[type='checkbox']");
      if (!checkbox) return;

      const filterKey =
        checkbox.closest("[data-filter-key]")?.dataset.filterKey;
      const value = checkbox.value;

      // Handle toggle switches (in stock, new arrivals)
      if (checkbox.id === "filterInStock") {
        activeFilters.inStockOnly = checkbox.checked;
        applyFilters();
        return;
      }

      if (checkbox.id === "filterNewArrivals") {
        activeFilters.newArrivalsOnly = checkbox.checked;
        applyFilters();
        return;
      }

      if (!filterKey) return;

      // Multi-select: add or remove value from array
      if (checkbox.checked) {
        if (!activeFilters[filterKey].includes(value)) {
          activeFilters[filterKey].push(value);
        }
      } else {
        activeFilters[filterKey] = activeFilters[filterKey].filter(
          (v) => v !== value,
        );
      }

      applyFilters();
    });

    // Reset filters button
    $("#resetAllFilters")?.addEventListener("click", resetAllFilters);

    // Price Range Slider
    const priceMinSlider = $("#priceMinSlider");
    const priceMaxSlider = $("#priceMaxSlider");
    const priceMinInput = $("#priceMinInput");
    const priceMaxInput = $("#priceMaxInput");
    const priceMinDisplay = $("#priceMinDisplay");
    const priceMaxDisplay = $("#priceMaxDisplay");

    function formatPriceDisplay(val) {
      return "₦" + Number(val).toLocaleString();
    }

    function updatePriceSlider() {
      const min = parseInt(priceMinSlider?.value || 0);
      const max = parseInt(priceMaxSlider?.value || 500000);

      // Update displays
      if (priceMinDisplay)
        priceMinDisplay.textContent = formatPriceDisplay(min);
      if (priceMaxDisplay)
        priceMaxDisplay.textContent = formatPriceDisplay(max);

      // Update inputs
      if (priceMinInput) priceMinInput.value = min;
      if (priceMaxInput) priceMaxInput.value = max;

      // Update filter (only if not at default values)
      if (min > 0 || max < 500000) {
        activeFilters.priceRange = `${min}-${max}`;
      } else {
        activeFilters.priceRange = "";
      }
    }

    function updatePriceFromInputs() {
      let min = parseInt(priceMinInput?.value || 0);
      let max = parseInt(priceMaxInput?.value || 500000);

      // Clamp values
      min = Math.max(0, Math.min(500000, min));
      max = Math.max(0, Math.min(500000, max));

      // Ensure min <= max
      if (min > max) [min, max] = [max, min];

      // Update sliders
      if (priceMinSlider) priceMinSlider.value = min;
      if (priceMaxSlider) priceMaxSlider.value = max;

      updatePriceSlider();
      debouncedFilter();
    }

    // Slider events
    priceMinSlider?.addEventListener("input", () => {
      const min = parseInt(priceMinSlider.value);
      const max = parseInt(priceMaxSlider?.value || 500000);
      if (min > max) priceMinSlider.value = max;
      updatePriceSlider();
    });

    priceMaxSlider?.addEventListener("input", () => {
      const min = parseInt(priceMinSlider?.value || 0);
      const max = parseInt(priceMaxSlider.value);
      if (max < min) priceMaxSlider.value = min;
      updatePriceSlider();
    });

    priceMinSlider?.addEventListener("change", applyFilters);
    priceMaxSlider?.addEventListener("change", applyFilters);

    // Input events
    priceMinInput?.addEventListener("change", updatePriceFromInputs);
    priceMaxInput?.addEventListener("change", updatePriceFromInputs);

    // Filter bar clicks - Old chip-based filters (kept for compatibility)
    filterBar?.addEventListener("click", (e) => {
      const chip = e.target.closest(".filter-chip");
      if (chip) {
        // Toggle dropdown
        const wasOpen = chip.classList.contains("open");
        $$(".filter-chip.open").forEach((c) => c.classList.remove("open"));
        if (!wasOpen) chip.classList.add("open");
        e.stopPropagation();
        return;
      }

      const dropItem = e.target.closest(".filter-dropdown-item");
      if (dropItem) {
        const key = dropItem.closest(".filter-chip")?.dataset.filterKey;
        const value = dropItem.dataset.value;
        if (!key) return;

        // Toggle selection
        if (activeFilters[key] === value) {
          activeFilters[key] = "";
          dropItem.classList.remove("selected");
        } else {
          dropItem
            .closest(".filter-dropdown")
            ?.querySelectorAll(".filter-dropdown-item")
            .forEach((d) => d.classList.remove("selected"));
          dropItem.classList.add("selected");
          activeFilters[key] = value;
        }

        // Update chip appearance
        const parentChip = dropItem.closest(".filter-chip");
        parentChip?.classList.toggle("active", !!activeFilters[key]);
        parentChip?.classList.remove("open");

        applyFilters();
        e.stopPropagation();
        return;
      }

      // Old filter opt (backward compatibility)
      const opt = e.target.closest(".filter-opt");
      if (!opt) return;
      const key = opt.closest("[data-filter-key]")?.dataset.filterKey;
      const value = opt.dataset.value;
      if (!key) return;

      const group = opt.closest(".filter-group");
      group
        ?.querySelectorAll(".filter-opt")
        .forEach((b) => b.classList.remove("active"));

      if (activeFilters[key] === value) {
        activeFilters[key] = "";
      } else {
        opt.classList.add("active");
        activeFilters[key] = value;
      }
      applyFilters();
    });

    // Close dropdowns when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".filter-chip")) {
        $$(".filter-chip.open").forEach((c) => c.classList.remove("open"));
      }
    });

    // Active chips remove
    $("#activeChips")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip-x");
      if (btn) clearFilter(btn.dataset.key, btn.dataset.value);
    });

    // Clear all
    $("#clearAllFilters")?.addEventListener("click", resetAllFilters);
    $("#clearFiltersBtn")?.addEventListener("click", resetAllFilters);

    // Search
    searchInput?.addEventListener("input", debouncedFilter);
    sortSelect?.addEventListener("change", applyFilters);

    // Product grid clicks - Only Add to Cart button opens modal
    productsGrid?.addEventListener("click", (e) => {
      const wishBtn = e.target.closest(".card-wishlist");
      const cartBtn = e.target.closest(".card-cart-btn");

      if (wishBtn) {
        e.stopPropagation();
        toggleWishlist(wishBtn.dataset.id, wishBtn);
        return;
      }
      if (cartBtn) {
        e.stopPropagation();
        const product = allProducts.find((p) => p.id === cartBtn.dataset.id);
        if (product) openModal(product);
        return;
      }
      // Clicking elsewhere on card does NOT open modal
    });

    // Double-click on card image for preview
    productsGrid?.addEventListener("dblclick", (e) => {
      const cardImg = e.target.closest(".card-image");
      if (!cardImg) return;
      const card = cardImg.closest(".product-card");
      if (!card) return;
      const product = allProducts.find((p) => p.id === card.dataset.id);
      if (product) {
        modalImages = parseArray(product.images);
        if (!modalImages.length)
          modalImages = [
            "https://placehold.co/400x500/f8fafc/be185d?text=No+Image",
          ];
        modalProduct = product;
        openImagePreview(0);
      }
    });

    // Double-tap on mobile for preview (touch devices)
    let lastTap = 0;
    productsGrid?.addEventListener("touchend", (e) => {
      const cardImg = e.target.closest(".card-image");
      if (!cardImg) return;
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        const card = cardImg.closest(".product-card");
        if (!card) return;
        const product = allProducts.find((p) => p.id === card.dataset.id);
        if (product) {
          modalImages = parseArray(product.images);
          if (!modalImages.length)
            modalImages = [
              "https://placehold.co/400x500/f8fafc/be185d?text=No+Image",
            ];
          modalProduct = product;
          openImagePreview(0);
        }
      }
      lastTap = now;
    });

    // Modal backdrop close
    productModal?.addEventListener("click", (e) => {
      if (e.target === productModal) closeModal();
    });

    // Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // Init
  function syncCheckboxesToFilters() {
    // Uncheck all checkboxes first to prevent browser autofill issues
    $$(".shop-sidebar input[type='checkbox']").forEach((cb) => {
      cb.checked = false;
    });
    // Then check only those that match current filters
    activeFilters.category.forEach((val) => {
      const cb = document.querySelector(
        `[data-filter-key="category"] input[value="${val}"]`,
      );
      if (cb) cb.checked = true;
    });
    activeFilters.gender.forEach((val) => {
      const cb = document.querySelector(
        `[data-filter-key="gender"] input[value="${val}"]`,
      );
      if (cb) cb.checked = true;
    });
    activeFilters.deliveryType.forEach((val) => {
      const cb = document.querySelector(
        `[data-filter-key="deliveryType"] input[value="${val}"]`,
      );
      if (cb) cb.checked = true;
    });
    const inStockCb = $("#filterInStock");
    if (inStockCb) inStockCb.checked = activeFilters.inStockOnly;
    const newArrivalsCb = $("#filterNewArrivals");
    if (newArrivalsCb) newArrivalsCb.checked = activeFilters.newArrivalsOnly;
  }

  async function init() {
    showSkeleton();
    setupEvents();
    applyURLParams();
    syncCheckboxesToFilters();

    // Export openModal globally so other pages (home, wishlist) can use it
    window.SHOP = { openModal, closeModal };

    let attempts = 0;
    while (!window.DB?.isReady && attempts < 20) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }

    allProducts = await fetchProducts();

    // Sync checkboxes again after DOM is fully ready to override browser form restoration
    syncCheckboxesToFilters();

    // Now allow change events to work normally
    isInitializing = false;

    applyFilters();

    // Mobile browsers restore form state after page load, so sync again after a delay
    setTimeout(() => {
      syncCheckboxesToFilters();
      applyFilters();
    }, 100);

    // Auto-open product modal if ?product= param is present (from cart/drawer edit links)
    const urlProduct = new URLSearchParams(window.location.search).get(
      "product",
    );
    if (urlProduct) {
      setTimeout(() => openModal(urlProduct), 400);
    }

    console.log("✅ SHOP: Ready");
  }

  // Also sync on window load event (catches mobile browser form restoration)
  window.addEventListener("load", () => {
    setTimeout(() => {
      if (!isInitializing) {
        syncCheckboxesToFilters();
        applyFilters();
      }
    }, 50);
  });

  // Handle back/forward navigation on mobile (pageshow event with persisted state)
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      // Page was restored from back-forward cache
      syncCheckboxesToFilters();
      applyFilters();
    }
  });

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
