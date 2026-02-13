// =============================================================
// Supabase Edge Function: send-contact-email
// Sends auto-reply to customer when a contact form is submitted.
// Admin sees messages in the Messages tab (no email notification).
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "contact@lingeriebysisioyin.store";
const ADMIN_EMAIL = "support@lingeriebysisioyin.store";
const BRAND = "Lingerie by Sisioyin";
const SITE_URL = "https://lingeriebysisioyin.store";
const REPLY_DOMAIN = "reply.lingeriebysisioyin.store";

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

// ── Admin notification email ────────────────────

function adminNotificationHTML(msg: ContactMessage): string {
  const ts = msg.timestamp || msg.created_at || new Date().toISOString();
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">

        <!-- Header -->
        <tr>
          <td style="background:#1e293b;padding:24px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">&#128233; New Contact Form Message</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:12px;font-weight:600;color:#64748b;">FROM</span><br>
                  <span style="font-size:15px;color:#1e293b;font-weight:600;">${msg.name}</span>
                  <span style="font-size:13px;color:#64748b;"> &lt;${msg.email}&gt;</span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:12px;font-weight:600;color:#64748b;">PHONE</span><br>
                  <span style="font-size:14px;color:#1e293b;">${msg.phone || "Not provided"}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:12px;font-weight:600;color:#64748b;">SUBJECT</span><br>
                  <span style="font-size:14px;color:#1e293b;">${msg.subject || "General"}</span>
                </td>
              </tr>
              ${
                msg.orderId
                  ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:12px;font-weight:600;color:#64748b;">ORDER ID</span><br>
                  <span style="font-size:14px;color:#be185d;font-weight:600;">${msg.orderId}</span>
                </td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:12px;font-weight:600;color:#64748b;">SENT AT</span><br>
                  <span style="font-size:13px;color:#64748b;">${new Date(ts).toLocaleString("en-NG")}</span>
                </td>
              </tr>
            </table>

            <div style="background:#f8fafc;padding:16px;border-radius:8px;border-left:4px solid #be185d;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;">MESSAGE</p>
              <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;">${(msg.message || "").slice(0, 2000)}</p>
            </div>

            <p style="text-align:center;margin:24px 0 0;">
              <a href="${SITE_URL}/admin.html" style="display:inline-block;background:#be185d;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                View in Admin Dashboard
              </a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #f1f5f9;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Reply to this email to respond directly to <strong>${msg.name}</strong></p>
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
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`📧 Contact form from: ${msg.name} <${msg.email}>`);

    // Build tagged reply-to so customer replies route back to the thread
    const msgId = msg.id || "";
    const replyTo = msgId ? `reply+${msgId}@${REPLY_DOMAIN}` : ADMIN_EMAIL;

    // 1) Send auto-reply to customer
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
        reply_to: replyTo,
      }),
    });

    if (!replyRes.ok) {
      const err = await replyRes.text();
      console.error("❌ Auto-reply failed:", err);
    } else {
      console.log("✅ Auto-reply sent to", msg.email);
    }

    // 2) Send notification email to admin
    try {
      const adminRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${BRAND} Notifications <${FROM_EMAIL}>`,
          to: [ADMIN_EMAIL],
          subject: `📩 New message from ${msg.name} — ${msg.subject || "General"}`,
          reply_to: msg.email,
          html: adminNotificationHTML(msg),
        }),
      });

      if (!adminRes.ok) {
        const err = await adminRes.text();
        console.error("❌ Admin notification failed:", err);
      } else {
        console.log("✅ Admin notified at", ADMIN_EMAIL);
      }
    } catch (e) {
      console.warn("Admin email error:", e);
    }

    // Send WhatsApp notification to admin (fire-and-forget)
    try {
      const SUPABASE_URL =
        Deno.env.get("SUPABASE_URL") ||
        "https://oriojylsilcsvcsefuux.supabase.co";
      fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_message",
          sender_name: msg.name,
          sender_email: msg.email,
          subject: msg.subject,
          message_preview: (msg.message || "").slice(0, 200),
        }),
      }).catch((e) =>
        console.warn("WhatsApp notification failed (non-blocking):", e),
      );
    } catch (e) {
      console.warn("WhatsApp error:", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("❌ Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
