// =============================================================
// Supabase Edge Function: send-admin-reply
// Sends a branded reply email to a customer from the admin dashboard.
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const DEFAULT_FROM_EMAIL = "support@lingeriebysisioyin.store";
const BRAND = "Lingerie by Sisioyin";
const SITE_URL = "https://lingeriebysisioyin.store";

const ALLOWED_FROM_EMAILS = [
  "support@lingeriebysisioyin.store",
  "info@lingeriebysisioyin.store",
  "orders@lingeriebysisioyin.store",
  "contact@lingeriebysisioyin.store",
];

interface ReplyPayload {
  messageId: string;
  recipientEmail: string;
  recipientName: string;
  originalSubject: string;
  originalMessage: string;
  replyText: string;
  fromEmail?: string;
}

function replyEmailHTML(payload: ReplyPayload): string {
  const firstName = (payload.recipientName || "").split(" ")[0] || "there";

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f4f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f4f0;padding:32px 16px;">
    <tr><td align="center">
      <!--[if mso]><table width="520" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">

        <!-- Header -->
        <tr>
          <td style="background-color:#be185d;padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">${BRAND}</h1>
            <p style="margin:8px 0 0;color:#f9a8d4;font-size:13px;">Elegance Delivered</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;font-weight:700;">Hi ${firstName}! &#128075;</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">
              Thank you for reaching out. Here's our reply to your inquiry:
            </p>

            <!-- Reply content -->
            <div style="background:#fdf2f8;border-left:4px solid #be185d;padding:20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
              <p style="margin:0;color:#1e293b;font-size:15px;line-height:1.7;white-space:pre-wrap;">${payload.replyText}</p>
            </div>

            <!-- Original message reference -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid #f1f5f9;padding-top:24px;"></td></tr>
            </table>
            <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;font-weight:600;">YOUR ORIGINAL MESSAGE</p>
            <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;"><strong>Subject:</strong> ${payload.originalSubject}</p>
            <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;margin-top:8px;">
              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${(payload.originalMessage || "").slice(0, 500)}</p>
            </div>

            <!-- CTA -->
            <p style="margin:24px 0 0;color:#475569;font-size:15px;line-height:1.7;">
              Need further help? You can reply to this email or chat with us on WhatsApp:
            </p>
            <p style="text-align:center;margin:20px 0 0;">
              <a href="https://wa.me/2349033344860" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                &#128172; Chat on WhatsApp
              </a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fdf2f8;padding:20px 32px;text-align:center;border-top:1px solid #f1f5f9;">
            <p style="margin:0 0 8px;color:#64748b;font-size:13px;">With love,<br><strong>${BRAND}</strong></p>
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              <a href="${SITE_URL}" style="color:#be185d;text-decoration:none;">lingeriebysisioyin.store</a>
            </p>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  // CORS
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
    const payload: ReplyPayload = await req.json();

    if (!payload.recipientEmail || !payload.replyText) {
      return new Response(
        JSON.stringify({ error: "Missing recipientEmail or replyText" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`📧 Sending admin reply to: ${payload.recipientEmail}`);

    // Validate and use the selected FROM email
    const fromEmail = ALLOWED_FROM_EMAILS.includes(payload.fromEmail || "")
      ? payload.fromEmail!
      : DEFAULT_FROM_EMAIL;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND} <${fromEmail}>`,
        to: [payload.recipientEmail],
        subject: `Re: ${payload.originalSubject} — ${BRAND}`,
        html: replyEmailHTML(payload),
        reply_to: fromEmail,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("❌ Reply email failed:", err);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: err }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    console.log("✅ Reply sent to", payload.recipientEmail);

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
