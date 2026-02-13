// =============================================================
// Supabase Edge Function: send-whatsapp-notification
// Sends WhatsApp notifications via Meta Cloud API using
// approved message templates (required for business-initiated).
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_WHATSAPP_NUMBER")!;

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
  order_number?: string;
  customer_name?: string;
  total?: number;
  items_count?: number;
  payment_method?: string;
  sender_name?: string;
  sender_email?: string;
  subject?: string;
  message_preview?: string;
  status?: string;
  product_name?: string;
  stock_count?: number;
  title?: string;
  body?: string;
  customer_whatsapp?: string;
}

function formatNGN(amount: number): string {
  return "N" + (amount || 0).toLocaleString("en-NG");
}

// ── Build template payload per notification type ──
function buildTemplatePayload(payload: NotificationPayload): {
  template: string;
  params: string[];
} | null {
  switch (payload.type) {
    case "new_order":
      return {
        template: "lbs_new_order",
        params: [
          payload.order_number || "N/A",
          payload.customer_name || "Unknown",
          String(payload.items_count || 0),
          formatNGN(payload.total || 0),
          payload.payment_method || "N/A",
        ],
      };

    case "new_message":
      return {
        template: "lbs_new_message",
        params: [
          payload.sender_name || "Unknown",
          payload.sender_email || "N/A",
          payload.subject || "General",
        ],
      };

    case "order_status":
      return {
        template: "lbs_order_status_admin",
        params: [
          payload.order_number || "N/A",
          payload.customer_name || "Unknown",
          (payload.status || "").toUpperCase(),
        ],
      };

    case "customer_order_confirmation":
      return {
        template: "lbs_customer_order_confirmed",
        params: [
          payload.customer_name || "there",
          payload.order_number || "N/A",
          formatNGN(payload.total || 0),
        ],
      };

    case "customer_order_status":
      return {
        template: "lbs_customer_order_update",
        params: [
          payload.customer_name || "there",
          payload.order_number || "N/A",
          (payload.status || "").toUpperCase(),
        ],
      };

    default:
      return null;
  }
}

// ── Send template message via Meta Cloud API ──
async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  params: string[],
): Promise<Response> {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en_US" },
      components:
        params.length > 0
          ? [
              {
                type: "body",
                parameters: params.map((p) => ({
                  type: "text",
                  text: p,
                })),
              },
            ]
          : [],
    },
  };

  return fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

// ── Handler ──
serve(async (req: Request) => {
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
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN || !ADMIN_PHONE) {
      console.warn("WhatsApp secrets not configured");
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp not configured" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const payload: NotificationPayload = await req.json();
    console.log(`Sending WhatsApp: ${payload.type}`);

    const isCustomerMsg = payload.type.startsWith("customer_");
    const recipient = isCustomerMsg ? payload.customer_whatsapp : ADMIN_PHONE;

    if (!recipient) {
      return new Response(
        JSON.stringify({ success: false, error: "No recipient number" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const tmpl = buildTemplatePayload(payload);
    if (!tmpl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unknown type: ${payload.type}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const waRes = await sendWhatsAppTemplate(
      recipient,
      tmpl.template,
      tmpl.params,
    );
    const waData = await waRes.json();

    if (!waRes.ok) {
      console.error("WhatsApp API error:", JSON.stringify(waData));
      return new Response(JSON.stringify({ success: false, error: waData }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("WhatsApp sent:", waData.messages?.[0]?.id);
    return new Response(
      JSON.stringify({ success: true, messageId: waData.messages?.[0]?.id }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("WhatsApp error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
