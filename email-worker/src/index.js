// =============================================================
// Cloudflare Email Worker: lbs-email-reply
//
// Catches inbound email replies from customers and forwards
// parsed data to the Supabase edge function (receive-email-reply).
//
// Cloudflare Email Routing sends matching emails here.
// This worker parses the MIME email and POSTs JSON to Supabase.
// =============================================================

import PostalMime from "postal-mime";

export default {
  /**
   * Handle inbound email from Cloudflare Email Routing.
   * @param {EmailMessage} message - The inbound email
   * @param {object} env - Worker environment (secrets/vars)
   * @param {ExecutionContext} ctx - Execution context
   */
  async email(message, env, ctx) {
    const WEBHOOK_URL =
      env.WEBHOOK_URL ||
      "https://oriojylsilcsvcsefuux.supabase.co/functions/v1/receive-email-reply";

    try {
      console.log(`📨 Email from: ${message.from} → ${message.to}`);

      // Quick check: only process tagged support+/reply+ addresses
      const toAddr = (message.to || "").toLowerCase();
      if (!toAddr.includes("+")) {
        console.log("⏭️ Skipping — no + tag in address:", toAddr);
        return;
      }

      // Read raw email stream into buffer
      const rawEmail = await new Response(message.raw).arrayBuffer();

      // Parse MIME with PostalMime
      const parser = new PostalMime();
      const parsed = await parser.parse(new Uint8Array(rawEmail));

      // Format "From" as "Name <email>" for the edge function
      const fromObj = parsed.from;
      let fromStr;
      if (fromObj && fromObj.name) {
        fromStr = `${fromObj.name} <${fromObj.address}>`;
      } else if (fromObj && fromObj.address) {
        fromStr = fromObj.address;
      } else {
        fromStr = message.from;
      }

      // Build payload matching the format receive-email-reply expects
      const payload = {
        type: "email.received",
        data: {
          from: fromStr,
          to: [message.to],
          subject: parsed.subject || "",
          text: parsed.text || "",
          html: parsed.html || "",
        },
      };

      console.log(`📧 Forwarding to webhook: ${parsed.subject}`);

      // POST to Supabase edge function
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`❌ Webhook ${res.status}:`, errText);
      } else {
        const result = await res.json();
        console.log("✅ Webhook OK:", result);
      }
    } catch (e) {
      // Don't throw — that would bounce the email back to the sender
      console.error("❌ Email worker error:", e);
    }
  },
};
