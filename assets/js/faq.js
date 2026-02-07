// FAQ Page JavaScript
document.addEventListener("DOMContentLoaded", function () {
  const tabs = document.querySelectorAll(".faq-tab");
  const categories = document.querySelectorAll(".faq-category");
  const searchInput = document.getElementById("faqSearch");
  const noResults = document.getElementById("faqNoResults");
  const clearSearchBtn = document.getElementById("clearFaqSearch");
  const faqContent = document.getElementById("faqContent");

  // Tab switching
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const category = tab.dataset.category;

      // Update active tab
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Show/hide categories
      if (category === "all") {
        categories.forEach((cat) => cat.classList.add("active"));
      } else {
        categories.forEach((cat) => {
          cat.classList.toggle("active", cat.dataset.category === category);
        });
      }

      // Clear search
      searchInput.value = "";
      noResults.classList.remove("show");
      faqContent.style.display = "block";
    });
  });

  // Accordion functionality
  document.querySelectorAll(".faq-question").forEach((question) => {
    question.addEventListener("click", () => {
      const item = question.closest(".faq-item");
      const isOpen = item.classList.contains("open");

      // Close all items
      document
        .querySelectorAll(".faq-item")
        .forEach((i) => i.classList.remove("open"));

      // Open clicked item if it was closed
      if (!isOpen) {
        item.classList.add("open");
      }
    });
  });

  // Search functionality
  let searchTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = searchInput.value.toLowerCase().trim();

      if (!query) {
        // Show all categories when search is cleared
        tabs.forEach((t) => t.classList.remove("active"));
        tabs[0].classList.add("active");
        categories.forEach((cat) => cat.classList.add("active"));
        noResults.classList.remove("show");
        faqContent.style.display = "block";
        return;
      }

      // Search through all FAQ items
      let hasResults = false;

      document.querySelectorAll(".faq-item").forEach((item) => {
        const question = item
          .querySelector(".faq-question span:first-child")
          .textContent.toLowerCase();
        const answer = item
          .querySelector(".faq-answer-content")
          .textContent.toLowerCase();
        const matches = question.includes(query) || answer.includes(query);

        item.style.display = matches ? "" : "none";
        if (matches) hasResults = true;
      });

      // Show/hide categories based on visible items
      categories.forEach((cat) => {
        const visibleItems =
          cat.querySelectorAll('.faq-item[style=""]').length +
          cat.querySelectorAll(".faq-item:not([style])").length;
        cat.classList.toggle("active", visibleItems > 0);
      });

      // Show no results message
      faqContent.style.display = hasResults ? "block" : "none";
      noResults.classList.toggle("show", !hasResults);

      // Update tabs
      tabs.forEach((t) => t.classList.remove("active"));
    }, 300);
  });

  // Clear search
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
  });
});
