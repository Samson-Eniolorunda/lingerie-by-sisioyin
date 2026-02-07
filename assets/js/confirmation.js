// Confirmation page logic
(function () {
  "use strict";

  function formatNaira(amount) {
    return "₦" + Number(amount || 0).toLocaleString("en-NG");
  }

  function init() {
    // Get order data from sessionStorage
    const orderDataStr = sessionStorage.getItem("LBS_CONFIRMED_ORDER");

    if (!orderDataStr) {
      // No order data, redirect to shop
      window.location.href = "/shop";
      return;
    }

    try {
      const order = JSON.parse(orderDataStr);

      // Populate order number
      document.getElementById("orderNumber").textContent = order.reference;

      // Populate items
      const itemsHtml = order.items
        .map(
          (item) => `
          <div class="order-item">
            <div class="order-item-img">
              <img src="${item.image || "assets/img/placeholder.png"}" alt="${item.name}" loading="lazy">
            </div>
            <div class="order-item-info">
              <div class="order-item-name">${item.name}</div>
              <div class="order-item-meta">
                ${item.selectedSize || "One Size"}${item.selectedColor ? " • " + item.selectedColor : ""} × ${item.qty}
              </div>
            </div>
            <div class="order-item-price">${formatNaira(item.price_ngn * item.qty)}</div>
          </div>
        `,
        )
        .join("");
      document.getElementById("orderItems").innerHTML = itemsHtml;

      // Populate totals
      document.getElementById("orderSubtotal").textContent = formatNaira(
        order.subtotal,
      );
      document.getElementById("orderDelivery").textContent = formatNaira(
        order.deliveryFee,
      );
      document.getElementById("orderTotal").textContent = formatNaira(
        order.total,
      );

      // Populate delivery address
      document.getElementById("deliveryAddress").innerHTML = `
        ${order.delivery.address}<br>
        ${order.delivery.city}, ${order.delivery.state}<br>
        ${order.delivery.landmark ? order.delivery.landmark : ""}
      `;

      // Populate contact info
      document.getElementById("contactInfo").innerHTML = `
        ${order.customer.firstName} ${order.customer.lastName}<br>
        ${order.customer.email}<br>
        ${order.customer.phone}
      `;

      // Populate customer email
      document.getElementById("customerEmail").textContent =
        order.customer.email;

      // Clear order data from session (one-time view)
      sessionStorage.removeItem("LBS_CONFIRMED_ORDER");
    } catch (err) {
      console.error("Error parsing order data:", err);
      window.location.href = "/shop";
    }
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Set current year
  const yearEl = document.getElementById("currentYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
