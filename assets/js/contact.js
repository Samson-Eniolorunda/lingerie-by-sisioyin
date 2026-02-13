// Contact Form Handler
(function () {
  "use strict";

  function init() {
    const form = document.getElementById("contactForm");
    const submitBtn = document.getElementById("contactSubmitBtn");
    const formSuccess = document.getElementById("formSuccess");

    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Get form data
      const formData = {
        name: document.getElementById("contactName").value.trim(),
        email: document.getElementById("contactEmail").value.trim(),
        phone: document.getElementById("contactPhone").value.trim(),
        subject: document.getElementById("contactSubject").value,
        orderId: document.getElementById("contactOrderId").value.trim(),
        message: document.getElementById("contactMessage").value.trim(),
        timestamp: new Date().toISOString(),
      };

      // Validate
      if (
        !formData.name ||
        !formData.email ||
        !formData.subject ||
        !formData.message
      ) {
        window.UTILS?.toast?.("Please fill in all required fields", "error");
        return;
      }

      // Show loading
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

      try {
        // Generate a stable UUID so reply-to tagging works
        const messageId = crypto.randomUUID();
        formData.id = messageId;

        // Save to Supabase
        let savedRecord = null;
        if (window.DB?.client) {
          const { error } = await window.DB.client
            .from("contact_messages")
            .insert([formData]);

          if (error) {
            console.error("Supabase error:", error);
          } else {
            savedRecord = formData;
          }
        }

        // Trigger email auto-reply + admin notification (fire-and-forget)
        try {
          const edgePayload = savedRecord || formData;
          fetch(
            "https://oriojylsilcsvcsefuux.supabase.co/functions/v1/send-contact-email",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(edgePayload),
            },
          ).catch((e) => console.warn("Edge function call failed:", e));
        } catch (e) {
          console.warn("Edge function error:", e);
        }

        // Show success
        form.style.display = "none";
        formSuccess.style.display = "block";
        window.UTILS?.toast?.("Message sent successfully!", "success");
        try {
          sessionStorage.removeItem("LBS_FORM__contact");
        } catch {}
      } catch (err) {
        console.error("Contact form error:", err);

        // Fallback: Open WhatsApp with message
        const whatsappMsg = encodeURIComponent(
          `*Contact Form Submission*\n\n` +
            `*Name:* ${formData.name}\n` +
            `*Email:* ${formData.email}\n` +
            `*Phone:* ${formData.phone || "Not provided"}\n` +
            `*Subject:* ${formData.subject}\n` +
            `*Order ID:* ${formData.orderId || "N/A"}\n\n` +
            `*Message:*\n${formData.message}`,
        );

        window.open(
          `https://wa.me/2349033344860?text=${whatsappMsg}`,
          "_blank",
        );

        // Show success anyway
        form.style.display = "none";
        formSuccess.style.display = "block";
      }
    });

    // Set current year
    const yearEl = document.getElementById("currentYear");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  // Reset form function
  window.resetContactForm = function () {
    const form = document.getElementById("contactForm");
    const formSuccess = document.getElementById("formSuccess");
    const submitBtn = document.getElementById("contactSubmitBtn");

    form.reset();
    form.style.display = "flex";
    formSuccess.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.innerHTML =
      '<i class="fa-solid fa-paper-plane"></i> Send Message';
  };

  // Bind reset button (replaces inline onclick)
  const resetBtn = document.getElementById("resetContactBtn");
  if (resetBtn) resetBtn.addEventListener("click", window.resetContactForm);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
