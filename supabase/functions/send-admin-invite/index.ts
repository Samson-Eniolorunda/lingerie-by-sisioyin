// =============================================================
// Supabase Edge Function: send-admin-invite
// Sends admin invitation emails via Resend when an admin
// is invited to join the store management team.
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "noreply@lingeriebysisioyin.store";
const BRAND = "Lingerie by Sisioyin";
const SITE_URL = "https://lingeriebysisioyin.store";

interface InviteRequest {
  email: string;
  invite_token: string;
  invited_role: string;
  inviter_name?: string;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  editor: "Editor - Can add and edit products",
  super_admin: "Super Admin - Full access to all features",
  owner: "Owner - Complete control of the store",
  developer: "Developer - Technical access and settings",
};

function generateInviteEmailHtml(
  email: string,
  inviteToken: string,
  role: string,
  inviterName?: string,
): string {
  const inviteUrl = `${SITE_URL}/admin?invite=${inviteToken}`;
  const roleDesc = ROLE_DESCRIPTIONS[role] || role;
  const inviterText = inviterName ? ` by ${inviterName}` : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>You're Invited to Join ${BRAND}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#be185d,#9d174d);padding:40px 30px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">
                You're Invited! ✨
              </h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">
                Join the ${BRAND} team
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                Hello,
              </p>
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
                You've been invited${inviterText} to join <strong>${BRAND}</strong> as a team member. 
                Click the button below to create your account and get started.
              </p>
              
              <!-- Role Badge -->
              <div style="background:#fdf2f8;border-left:4px solid #be185d;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">
                <p style="margin:0;color:#9d174d;font-size:14px;font-weight:600;">
                  <span style="display:inline-block;margin-right:8px;">🎭</span>
                  Your Role: ${roleDesc}
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align:center;margin:32px 0;">
                <a href="${inviteUrl}" 
                   style="display:inline-block;background:linear-gradient(135deg,#be185d,#9d174d);color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:600;font-size:16px;box-shadow:0 4px 12px rgba(190,24,93,0.3);">
                  Accept Invitation
                </a>
              </div>
              
              <p style="margin:24px 0 0;color:#6b7280;font-size:14px;line-height:1.6;text-align:center;">
                This invitation will expire in 7 days.
              </p>
              
              <!-- Link fallback -->
              <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px;">
                <p style="margin:0 0 8px;color:#6b7280;font-size:12px;">
                  If the button doesn't work, copy and paste this link:
                </p>
                <p style="margin:0;color:#be185d;font-size:12px;word-break:break-all;">
                  ${inviteUrl}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 30px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} ${BRAND}. All rights reserved.
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
                If you didn't expect this invitation, you can safely ignore this email.
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
    const body: InviteRequest = await req.json();
    const { email, invite_token, invited_role, inviter_name } = body;

    if (!email || !invite_token) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: email, invite_token",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const html = generateInviteEmailHtml(
      email,
      invite_token,
      invited_role,
      inviter_name,
    );

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${BRAND} <${FROM_EMAIL}>`,
        to: email,
        subject: `You're invited to join ${BRAND}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: err }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    console.log("Invite email sent to:", email, "ID:", data.id);

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
