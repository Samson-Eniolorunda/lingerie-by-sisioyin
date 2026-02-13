// =============================================================
// Supabase Edge Function: send-contact-email
// Sends auto-reply to customer when a contact form is submitted.
// Admin sees messages in the Messages tab (no email notification).
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "contact@lingeriebysisioyin.store";
const BRAND = "Lingerie by Sisioyin";
const SITE_URL = "https://lingeriebysisioyin.store";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  orderId: string | null;
  message: string;
  timestamp: string;
  created_at: string;
}

// ── Auto-reply to customer ─────────────────────

function autoReplyHTML(msg: ContactMessage): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f4f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f4f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">

        <!-- Header -->
        <tr>
          <td style="background-color:#be185d;padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${BRAND}</h1>
            <p style="margin:8px 0 0;color:#f9a8d4;font-size:13px;">Elegance Delivered</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Hi ${msg.name.split(" ")[0]}! &#128075;</h2>
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">
              Thank you for reaching out to us. We've received your message and our team will get back to you within <strong>24 hours</strong>.
            </p>
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">
              Here's a summary of what you sent:
            </p>
            <div style="background:#fdf2f8;padding:16px;border-radius:8px;margin:0 0 24px;">
              <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:600;">Subject</p>
              <p style="margin:0;color:#1e293b;font-size:14px;">${msg.subject}</p>
            </div>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">
              In the meantime, you can also reach us directly on WhatsApp for faster assistance:
            </p>
            <p style="text-align:center;">
              <a href="https://wa.me/2349033344860" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;">
                &#128172; Chat on WhatsApp
              </a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #f1f5f9;">
            <p style="margin:0 0 8px;color:#64748b;font-size:13px;">With love,<br><strong>${BRAND}</strong></p>
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              <a href="${SITE_URL}" style="color:#be185d;text-decoration:none;">lingeriebysisioyin.store</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main Handler ───────────────────────────────

serve(async (req: Request) => {
  // CORS for browser calls
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const msg: ContactMessage = body.record || body;

    if (!msg.email || !msg.name || !msg.message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`📧 Contact form from: ${msg.name} <${msg.email}>`);

    // Send auto-reply to customer (admin sees it in Messages tab)
    const replyRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND} <${FROM_EMAIL}>`,
        to: [msg.email],
        subject: `We received your message — ${BRAND}`,
        html: autoReplyHTML(msg),
      }),
    });

    if (!replyRes.ok) {
      const err = await replyRes.text();
      console.error("❌ Auto-reply failed:", err);
    } else {
      console.log("✅ Auto-reply sent to", msg.email);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("❌ Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
