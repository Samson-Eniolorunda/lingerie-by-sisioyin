// =============================================================
// Supabase Edge Function: send-whatsapp-notification
// Sends WhatsApp notifications to the admin for new orders,
// contact messages, and other events via Meta Cloud API (free).
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ── Environment Variables ──
// Set these as Supabase secrets:
//   supabase secrets set WHATSAPP_PHONE_NUMBER_ID=xxxxxxx
//   supabase secrets set WHATSAPP_ACCESS_TOKEN=xxxxxxx
//   supabase secrets set ADMIN_WHATSAPP_NUMBER=234xxxxxxxxxx
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_WHATSAPP_NUMBER")!;
const BRAND = "Lingerie by Sisioyin";

// ── Types ──
type NotificationType =
  | "new_order"
  | "new_message"
  | "order_status"
  | "low_stock"
  | "new_customer"
  | "customer_order_confirmation"
  | "customer_order_status";

interface NotificationPayload {
  type: NotificationType;
  // New order
  order_number?: string;
  customer_name?: string;
  total?: number;
  items_count?: number;
  payment_method?: string;
  // New message
  sender_name?: string;
  sender_email?: string;
  subject?: string;
  message_preview?: string;
  // Order status
  status?: string;
  // Low stock
  product_name?: string;
  stock_count?: number;
  // Generic
  title?: string;
  body?: string;
  // Customer WhatsApp (sent to customer's own number)
  customer_whatsapp?: string;
}

// ── Format currency ──
function formatNGN(amount: number): string {
  return "₦" + (amount || 0).toLocaleString("en-NG");
}

// ── Build WhatsApp text message per type ──
function buildMessage(payload: NotificationPayload): string {
  const divider = "─────────────────";

  switch (payload.type) {
    case "new_order":
      return [
        `🛍️ *NEW ORDER — ${BRAND}*`,
        divider,
        `*Order:* #${payload.order_number}`,
        `*Customer:* ${payload.customer_name}`,
        `*Items:* ${payload.items_count} item(s)`,
        `*Total:* ${formatNGN(payload.total || 0)}`,
        `*Payment:* ${payload.payment_method || "N/A"}`,
        divider,
        `Open your admin dashboard to view details.`,
      ].join("\n");

    case "new_message":
      return [
        `✉️ *NEW MESSAGE — ${BRAND}*`,
        divider,
        `*From:* ${payload.sender_name}`,
        `*Email:* ${payload.sender_email}`,
        `*Subject:* ${payload.subject || "General"}`,
        `*Preview:* ${(payload.message_preview || "").slice(0, 200)}`,
        divider,
        `Reply from your admin inbox.`,
      ].join("\n");

    case "order_status":
      return [
        `📦 *ORDER STATUS CHANGE — ${BRAND}*`,
        divider,
        `*Order:* #${payload.order_number}`,
        `*Customer:* ${payload.customer_name}`,
        `*New Status:* ${(payload.status || "").toUpperCase()}`,
        divider,
      ].join("\n");

    case "low_stock":
      return [
        `⚠️ *LOW STOCK ALERT — ${BRAND}*`,
        divider,
        `*Product:* ${payload.product_name}`,
        `*Remaining:* ${payload.stock_count} unit(s)`,
        divider,
        `Restock soon to avoid missed sales.`,
      ].join("\n");

    case "new_customer":
      return [
        `👤 *NEW CUSTOMER — ${BRAND}*`,
        divider,
        `*Name:* ${payload.customer_name}`,
        divider,
      ].join("\n");

    case "customer_order_confirmation":
      return [
        `🛍️ *Order Confirmed! — ${BRAND}*`,
        divider,
        `Hi ${payload.customer_name || "there"}! 🎉`,
        ``,
        `Your order *#${payload.order_number}* has been received.`,
        `*Items:* ${payload.items_count} item(s)`,
        `*Total:* ${formatNGN(payload.total || 0)}`,
        ``,
        `We'll notify you when it ships.`,
        `Track your order: lingeriebysisioyin.store/track`,
        divider,
        `Thank you for shopping with us! 💕`,
      ].join("\n");

    case "customer_order_status":
      return [
        `📦 *Order Update — ${BRAND}*`,
        divider,
        `Hi ${payload.customer_name || "there"}!`,
        ``,
        `Your order *#${payload.order_number}* is now: *${(payload.status || "").toUpperCase()}*`,
        ``,
        `Track your order: lingeriebysisioyin.store/track`,
        divider,
        `Thank you for your patience! 💕`,
      ].join("\n");

    default:
      return [
        `🔔 *${payload.title || "NOTIFICATION"} — ${BRAND}*`,
        divider,
        payload.body || "Something happened. Check your dashboard.",
        divider,
      ].join("\n");
  }
}

// ── Send via Meta Cloud API ──
async function sendWhatsApp(message: string, to?: string): Promise<Response> {
  const recipient = to || ADMIN_PHONE;

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { preview_url: false, body: message },
      }),
    }
  );

  return res;
}

// ── Handler ──
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
    // Validate secrets exist
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN || !ADMIN_PHONE) {
      console.warn("⚠️ WhatsApp secrets not configured — skipping");
      return new Response(
        JSON.stringify({
          success: false,
          error: "WhatsApp not configured. Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and ADMIN_WHATSAPP_NUMBER as Supabase secrets.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload: NotificationPayload = await req.json();
    const message = buildMessage(payload);
    console.log(`📱 Sending WhatsApp notification: ${payload.type}`);

    // Determine recipient: customer-facing types → customer's number; else → admin
    const isCustomerMsg = payload.type.startsWith("customer_");
    const recipient = isCustomerMsg ? payload.customer_whatsapp : undefined; // undefined → admin default

    if (isCustomerMsg && !recipient) {
      return new Response(
        JSON.stringify({ success: false, error: "No customer WhatsApp number provided" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const waRes = await sendWhatsApp(message, recipient);
    const waData = await waRes.json();

    if (!waRes.ok) {
      console.error("WhatsApp API error:", JSON.stringify(waData));
      return new Response(
        JSON.stringify({ success: false, error: waData }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("✅ WhatsApp notification sent:", waData.messages?.[0]?.id);
    return new Response(
      JSON.stringify({ success: true, messageId: waData.messages?.[0]?.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("WhatsApp notification error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
