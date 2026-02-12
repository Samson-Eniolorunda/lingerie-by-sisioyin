// =============================================================
// Supabase Edge Function: send-contact-email
// Sends email notification to admin when a contact form is submitted.
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL = "adelugbaoyindamola@lingeriebysisioyin.store";
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

// ── Email HTML Template ────────────────────────

function contactEmailHTML(msg: ContactMessage): string {
  const date = new Date(msg.timestamp || msg.created_at).toLocaleDateString(
    "en-NG",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

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
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">${BRAND}</h1>
            <p style="margin:8px 0 0;color:#f9a8d4;font-size:13px;">New Contact Form Submission</p>
          </td>
        </tr>

        <!-- Subject -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">&#128233; ${msg.subject}</h2>
            <p style="margin:0;color:#64748b;font-size:14px;">Received on ${date}</p>
          </td>
        </tr>

        <!-- Sender Info -->
        <tr>
          <td style="padding:0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf2f8;border-radius:8px;margin:16px 0;">
              <tr>
                <td style="padding:16px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:4px 0;">
                        <span style="color:#64748b;font-size:13px;font-weight:600;">Name:</span>
                        <span style="color:#1e293b;font-size:14px;margin-left:8px;">${msg.name}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;">
                        <span style="color:#64748b;font-size:13px;font-weight:600;">Email:</span>
                        <a href="mailto:${msg.email}" style="color:#be185d;font-size:14px;margin-left:8px;text-decoration:none;">${msg.email}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;">
                        <span style="color:#64748b;font-size:13px;font-weight:600;">Phone:</span>
                        <span style="color:#1e293b;font-size:14px;margin-left:8px;">${msg.phone || "Not provided"}</span>
                      </td>
                    </tr>
                    ${
                      msg.orderId
                        ? `<tr>
                      <td style="padding:4px 0;">
                        <span style="color:#64748b;font-size:13px;font-weight:600;">Order ID:</span>
                        <span style="color:#be185d;font-size:14px;margin-left:8px;font-weight:600;">${msg.orderId}</span>
                      </td>
                    </tr>`
                        : ""
                    }
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="padding:0 32px 24px;">
            <h3 style="margin:0 0 12px;color:#1e293b;font-size:15px;">Message</h3>
            <div style="background:#f8fafc;border-left:4px solid #be185d;padding:16px;border-radius:0 8px 8px 0;">
              <p style="margin:0;color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap;">${msg.message}</p>
            </div>
          </td>
        </tr>

        <!-- Reply Button -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject)}" style="display:inline-block;background:#be185d;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;">
              Reply to ${msg.name.split(" ")[0]}
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #f1f5f9;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              This is an automated notification from your website contact form.<br>
              <a href="${SITE_URL}/admin" style="color:#be185d;text-decoration:none;">View in Admin Dashboard</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

    // 1. Send notification to admin
    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND} <${FROM_EMAIL}>`,
        to: [ADMIN_EMAIL],
        subject: `📩 Contact Form: ${msg.subject} — from ${msg.name}`,
        html: contactEmailHTML(msg),
        reply_to: msg.email,
      }),
    });

    if (!adminRes.ok) {
      const err = await adminRes.text();
      console.error("❌ Admin email failed:", err);
    } else {
      console.log("✅ Admin notification sent");
    }

    // 2. Send auto-reply to customer
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
