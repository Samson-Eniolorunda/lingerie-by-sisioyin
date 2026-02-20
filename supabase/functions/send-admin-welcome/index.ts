// =============================================================
// Supabase Edge Function: send-admin-welcome
// Sends welcome email to new admins after they verify their
// email address, including their role info and login link.
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "noreply@lingeriebysisioyin.store";
const BRAND = "Lingerie by Sisioyin";
const SITE_URL = "https://lingeriebysisioyin.store";

interface WelcomeRequest {
  email: string;
  first_name: string;
  role: string;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  editor: "Editor",
  super_admin: "Super Admin",
  owner: "Owner",
  developer: "Developer",
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  editor: [
    "View and manage products",
    "View orders",
    "Respond to customer messages",
  ],
  super_admin: [
    "Full access to all features",
    "Manage products and orders",
    "View analytics and reports",
    "Respond to customer messages",
  ],
  owner: [
    "Complete control of the store",
    "Manage team members",
    "Access all settings",
    "View all analytics",
  ],
  developer: [
    "Technical settings access",
    "API and integration management",
    "Full feature access",
  ],
};

function generateWelcomeEmailHtml(
  firstName: string,
  role: string
): string {
  const loginUrl = `${SITE_URL}/admin?mode=staff`;
  const roleTitle = ROLE_DESCRIPTIONS[role] || role;
  const permissions = ROLE_PERMISSIONS[role] || ["Access the admin dashboard"];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to ${BRAND}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#be185d,#9d174d);padding:40px 30px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">
                Welcome to the Team! 🎉
              </h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">
                ${BRAND} Admin Team
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                Hi ${firstName},
              </p>
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                Your account has been verified and you're now part of the <strong>${BRAND}</strong> team!
                We're excited to have you on board.
              </p>
              
              <!-- Role Info Box -->
              <div style="background:linear-gradient(135deg,#fdf2f8,#fce7f3);border-radius:12px;padding:24px;margin:24px 0;">
                <h3 style="margin:0 0 12px;color:#9d174d;font-size:16px;font-weight:600;">
                  Your Role: ${roleTitle}
                </h3>
                <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
                  As a ${roleTitle}, you have access to:
                </p>
                <ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:1.8;">
                  ${permissions.map(p => `<li>${p}</li>`).join("")}
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align:center;margin:32px 0;">
                <a href="${loginUrl}" 
                   style="display:inline-block;background:linear-gradient(135deg,#be185d,#9d174d);color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:600;font-size:16px;box-shadow:0 4px 12px rgba(190,24,93,0.3);">
                  Go to Admin Dashboard
                </a>
              </div>
              
              <p style="margin:24px 0 0;color:#6b7280;font-size:14px;line-height:1.6;">
                If you have any questions, feel free to reach out to the store owner.
              </p>
            </td>
          </tr>
          
          <!-- Tips Section -->
          <tr>
            <td style="padding:0 30px 30px;">
              <div style="background:#f9fafb;border-radius:12px;padding:20px;">
                <h4 style="margin:0 0 12px;color:#374151;font-size:14px;font-weight:600;">
                  💡 Quick Tips
                </h4>
                <ul style="margin:0;padding:0 0 0 20px;color:#6b7280;font-size:13px;line-height:1.8;">
                  <li>Bookmark the admin dashboard for quick access</li>
                  <li>Use keyboard shortcuts to navigate faster</li>
                  <li>Check the dashboard regularly for new orders</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 30px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} ${BRAND}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

serve(async (req) => {
  // Handle CORS preflight
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
    const body: WelcomeRequest = await req.json();
    const { email, first_name, role } = body;

    if (!email || !first_name || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, first_name, role" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const html = generateWelcomeEmailHtml(first_name, role);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${BRAND} <${FROM_EMAIL}>`,
        to: email,
        subject: `Welcome to ${BRAND} – You're all set!`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: err }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    console.log("Welcome email sent to:", email, "ID:", data.id);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
