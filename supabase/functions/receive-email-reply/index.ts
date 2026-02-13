// =============================================================
// Supabase Edge Function: receive-email-reply
// Receives parsed inbound emails (from Cloudflare Email Worker)
// and inserts customer replies into the message_replies thread.
//
// Called by: email-worker/src/index.js (Cloudflare Worker)
// Format:    POST { type: "email.received", data: { from, to, subject, text, html } }
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || "https://oriojylsilcsvcsefuux.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";

// ── Helpers ─────────────────────────────────────

/**
 * Extract the message ID from a tagged reply-to address.
 * Supports both formats:
 *   "support+abc123@lingeriebysisioyin.store"  (current)
 *   "reply+abc123@reply.lingeriebysisioyin.store"  (legacy)
 */
function extractMessageId(address: string): string | null {
  const match = address.match(/^(?:support|reply)\+([^@]+)@/i);
  return match ? match[1] : null;
}

/**
 * Extract the sender name from email "From" field.
 * "Jane Doe <jane@example.com>" → "Jane Doe"
 * "jane@example.com" → "jane"
 */
function extractSenderName(from: string): string {
  const nameMatch = from.match(/^(.+?)\s*<[^>]+>$/);
  if (nameMatch) return nameMatch[1].replace(/['"]/g, "").trim();
  // Just an email — use the local part
  const emailMatch = from.match(/^([^@]+)@/);
  return emailMatch ? emailMatch[1] : from;
}

/**
 * Extract a clean email address from the "From" field.
 * "Jane Doe <jane@example.com>" → "jane@example.com"
 */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

/**
 * Strip quoted content from an email reply.
 * Removes:
 *   - Lines starting with ">"
 *   - "On ... wrote:" blocks
 *   - "--" signature separators
 *   - "--- Original Message ---" separators
 *   - Forwarded message headers
 */
function stripQuotedText(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  const cleanLines: string[] = [];
  let hitQuote = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop at common quote markers
    if (
      /^on\s+.+wrote:$/i.test(trimmed) ||
      /^-{2,}\s*(original|forwarded)\s+message/i.test(trimmed) ||
      /^_{3,}/.test(trimmed) ||
      /^>{3,}/.test(trimmed) ||
      (/^from:\s+/i.test(trimmed) && hitQuote)
    ) {
      break;
    }

    // Skip lines that start with ">" (quoted)
    if (/^>/.test(trimmed)) {
      hitQuote = true;
      continue;
    }

    // Stop at signature separator
    if (trimmed === "--" || trimmed === "-- ") {
      break;
    }

    cleanLines.push(line);
  }

  return cleanLines.join("\n").trim();
}

/**
 * Strip quoted content from HTML reply.
 * Removes Gmail quote divs, Outlook quote blocks, etc.
 */
function stripQuotedHTML(html: string): string {
  if (!html) return "";

  // Remove Gmail quote blocks
  let clean = html.replace(
    /<div\s+class=["']gmail_quote["'][^>]*>[\s\S]*$/i,
    "",
  );

  // Remove Outlook quote blocks
  clean = clean.replace(/<div\s+id=["']?appendonsend["']?[^>]*>[\s\S]*$/i, "");

  // Remove blockquote elements (common in many clients)
  clean = clean.replace(/<blockquote[\s\S]*$/i, "");

  // Remove "On ... wrote:" patterns in remaining HTML
  clean = clean.replace(/<div[^>]*>On\s+.*?wrote:[\s\S]*$/i, "");

  // Strip all remaining HTML tags to get plain text
  clean = clean.replace(/<[^>]+>/g, " ");

  // Collapse whitespace
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

// ── Main Handler ────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, svix-id, svix-timestamp, svix-signature",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Resend wraps inbound emails in { type: "email.received", data: {...} }
    const eventType = body.type || "";
    const emailData = body.data || body;

    console.log(`📨 Inbound webhook: type=${eventType}`);

    // Only process email.received events (ignore other webhook types)
    if (eventType && eventType !== "email.received") {
      console.log(`⏭️ Skipping event type: ${eventType}`);
      return new Response(JSON.stringify({ ok: true, skipped: eventType }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract fields from Resend inbound payload
    const fromRaw: string = emailData.from || "";
    const toAddresses: string[] = Array.isArray(emailData.to)
      ? emailData.to
      : [emailData.to || ""];
    const subject: string = emailData.subject || "";
    const textBody: string = emailData.text || "";
    const htmlBody: string = emailData.html || "";

    const senderEmail = extractEmail(fromRaw);
    const senderName = extractSenderName(fromRaw);

    console.log(`📧 From: ${senderName} <${senderEmail}>`);
    console.log(`📧 To: ${toAddresses.join(", ")}`);
    console.log(`📧 Subject: ${subject}`);

    // Find the tagged address to extract the message ID
    let messageId: string | null = null;
    for (const addr of toAddresses) {
      messageId = extractMessageId(addr);
      if (messageId) break;
    }

    if (!messageId) {
      console.warn(
        "⚠️ No tagged message ID found in To addresses:",
        toAddresses,
      );
      // Still return 200 to prevent Resend from retrying
      return new Response(
        JSON.stringify({ ok: false, error: "No message ID in address" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`🔗 Linked to message: ${messageId}`);

    // Extract reply text — prefer plain text, fall back to HTML stripping
    let replyText = stripQuotedText(textBody);
    if (!replyText && htmlBody) {
      replyText = stripQuotedHTML(htmlBody);
    }

    if (!replyText) {
      console.warn("⚠️ Empty reply body after stripping quotes");
      replyText = "(No text content)";
    }

    // Truncate very long replies
    if (replyText.length > 5000) {
      replyText = replyText.slice(0, 5000) + "…";
    }

    console.log(
      `💬 Reply text (${replyText.length} chars): ${replyText.slice(0, 100)}…`,
    );

    // Verify the message exists in contact_messages
    if (!SUPABASE_SERVICE_KEY) {
      console.error("❌ SUPABASE_SERVICE_ROLE_KEY not set");
      return new Response(
        JSON.stringify({ ok: false, error: "Server misconfigured" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Check the original message exists
    const { data: originalMsg, error: lookupErr } = await sb
      .from("contact_messages")
      .select("id, name, email")
      .eq("id", messageId)
      .maybeSingle();

    if (lookupErr) {
      console.error("❌ DB lookup error:", lookupErr);
    }

    if (!originalMsg) {
      console.warn(`⚠️ Message ${messageId} not found in contact_messages`);
      // Still save the reply — it might be useful
    }

    // Insert the customer reply into message_replies
    const { error: insertErr } = await sb.from("message_replies").insert({
      message_id: messageId,
      reply_text: replyText,
      sender_type: "customer",
      sender_name: senderName,
      sender_email: senderEmail,
      sent_at: new Date().toISOString(),
    });

    if (insertErr) {
      console.error("❌ Failed to insert reply:", insertErr);
      return new Response(
        JSON.stringify({ ok: false, error: "DB insert failed" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Update the message status so admin sees new activity
    const { error: updateErr } = await sb
      .from("contact_messages")
      .update({ status: "unread" })
      .eq("id", messageId);

    if (updateErr) {
      console.warn("⚠️ Failed to update message status:", updateErr);
    }

    console.log(`✅ Customer reply saved for message ${messageId}`);

    // Send WhatsApp notification to admin (fire-and-forget)
    try {
      fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_message",
          sender_name: senderName,
          sender_email: senderEmail,
          subject: `Email reply: ${subject}`,
          message_preview: replyText.slice(0, 200),
        }),
      }).catch((e) =>
        console.warn("WhatsApp notification failed (non-blocking):", e),
      );
    } catch (e) {
      console.warn("WhatsApp error:", e);
    }

    return new Response(
      JSON.stringify({ ok: true, messageId, from: senderEmail }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err) {
    console.error("❌ Webhook error:", err);
    // Always return 200 to prevent infinite retries from Resend
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
