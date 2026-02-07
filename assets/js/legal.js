// Legal pages (Privacy & Terms) - TOC highlighting
document.addEventListener("DOMContentLoaded", function () {
  const tocLinks = document.querySelectorAll(".legal-toc-link");
  const sections = document.querySelectorAll(".legal-section");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tocLinks.forEach((link) => link.classList.remove("active"));
          const activeLink = document.querySelector(
            `.legal-toc-link[href="#${entry.target.id}"]`,
          );
          if (activeLink) activeLink.classList.add("active");
        }
      });
    },
    { threshold: 0.3, rootMargin: "-100px 0px -50% 0px" },
  );
  sections.forEach((section) => observer.observe(section));
});
