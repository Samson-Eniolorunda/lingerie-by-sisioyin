// =============================================================
// Supabase Edge Function: send-order-email
// Sends order confirmation emails via Resend when a new order
// is inserted into the orders table.
// =============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL = "adelugbaoyindamola@lingeriebysisioyin.store";
const FROM_EMAIL = "orders@lingeriebysisioyin.store";
const BRAND = "Lingerie by Sisioyin";
const SITE_URL = "https://lingeriebysisioyin.store";

interface OrderItem {
  name: string;
  price_ngn: number;
  qty: number;
  selectedSize?: string;
  selectedColor?: string;
  image?: string;
}

interface OrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  promo_code: string | null;
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────

function formatNaira(amount: number): string {
  return (
    "₦" +
    Number(amount || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Email HTML Templates ───────────────────────

function buildItemRows(items: OrderItem[]): string {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 8px;border-bottom:1px solid #f0e6d8;">
          <strong style="color:#2d2319;">${item.name}</strong><br>
          <span style="color:#8b7355;font-size:13px;">
            ${item.selectedSize || "One Size"}${item.selectedColor ? " &bull; " + item.selectedColor : ""}
          </span>
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #f0e6d8;text-align:center;color:#5a4a3a;">${item.qty}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #f0e6d8;text-align:right;color:#2d2319;font-weight:600;">${formatNaira(item.price_ngn * item.qty)}</td>
      </tr>`,
    )
    .join("");
}

function customerEmailHTML(order: OrderRecord): string {
  const itemRows = buildItemRows(order.items);

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#8b5a2b,#a0724e);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">${BRAND}</h1>
          </td>
        </tr>

        <!-- Thank You -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <h2 style="margin:0 0 8px;color:#2d2319;font-size:22px;">Thank you for your order! 🎉</h2>
            <p style="margin:0;color:#8b7355;font-size:15px;">
              Hi ${order.customer_name.split(" ")[0]}, we've received your order and it's being prepared with care.
            </p>
          </td>
        </tr>

        <!-- Order Info Bar -->
        <tr>
          <td style="padding:0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:8px;margin:16px 0;">
              <tr>
                <td style="padding:16px;text-align:center;border-right:1px solid #f0e6d8;">
                  <span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Order Number</span><br>
                  <strong style="color:#2d2319;font-size:16px;">${order.order_number}</strong>
                </td>
                <td style="padding:16px;text-align:center;border-right:1px solid #f0e6d8;">
                  <span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date</span><br>
                  <strong style="color:#2d2319;font-size:14px;">${formatDate(order.created_at)}</strong>
                </td>
                <td style="padding:16px;text-align:center;">
                  <span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Total</span><br>
                  <strong style="color:#8b5a2b;font-size:16px;">${formatNaira(order.total)}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:0 32px;">
            <h3 style="margin:0 0 12px;color:#2d2319;font-size:16px;">Order Items</h3>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr style="border-bottom:2px solid #f0e6d8;">
                <th style="padding:8px;text-align:left;color:#8b7355;font-size:13px;font-weight:600;">Item</th>
                <th style="padding:8px;text-align:center;color:#8b7355;font-size:13px;font-weight:600;">Qty</th>
                <th style="padding:8px;text-align:right;color:#8b7355;font-size:13px;font-weight:600;">Price</th>
              </tr>
              ${itemRows}
            </table>
          </td>
        </tr>

        <!-- Totals -->
        <tr>
          <td style="padding:16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;color:#8b7355;font-size:14px;">Subtotal</td>
                <td style="padding:6px 0;text-align:right;color:#2d2319;font-size:14px;">${formatNaira(order.subtotal)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#8b7355;font-size:14px;">Shipping</td>
                <td style="padding:6px 0;text-align:right;color:#2d2319;font-size:14px;">${formatNaira(order.shipping_cost)}</td>
              </tr>
              ${
                order.discount_amount > 0
                  ? `
              <tr>
                <td style="padding:6px 0;color:#27ae60;font-size:14px;">Discount${order.promo_code ? " (" + order.promo_code + ")" : ""}</td>
                <td style="padding:6px 0;text-align:right;color:#27ae60;font-size:14px;">-${formatNaira(order.discount_amount)}</td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="padding:12px 0 0;color:#2d2319;font-size:18px;font-weight:700;border-top:2px solid #f0e6d8;">Total</td>
                <td style="padding:12px 0 0;text-align:right;color:#8b5a2b;font-size:18px;font-weight:700;border-top:2px solid #f0e6d8;">${formatNaira(order.total)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Delivery -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:8px;">
              <tr>
                <td style="padding:20px;">
                  <h3 style="margin:0 0 8px;color:#2d2319;font-size:15px;">📦 Delivery Details</h3>
                  <p style="margin:0;color:#5a4a3a;font-size:14px;line-height:1.6;">
                    ${order.delivery_address}<br>
                    ${order.delivery_city}, ${order.delivery_state}<br>
                    📞 ${order.customer_phone}
                  </p>
                  ${order.notes ? `<p style="margin:8px 0 0;color:#8b7355;font-size:13px;font-style:italic;">Note: ${order.notes}</p>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="${SITE_URL}/dashboard.html" style="display:inline-block;background:#8b5a2b;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
              Track Your Order
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf8f5;padding:24px 32px;text-align:center;border-top:1px solid #f0e6d8;">
            <p style="margin:0 0 8px;color:#8b7355;font-size:13px;">
              Questions? Reply to this email or reach us at
              <a href="mailto:support@lingeriebysisioyin.store" style="color:#8b5a2b;">support@lingeriebysisioyin.store</a>
            </p>
            <p style="margin:0;color:#b8a898;font-size:12px;">
              &copy; ${new Date().getFullYear()} ${BRAND} &bull;
              <a href="${SITE_URL}" style="color:#8b7355;text-decoration:none;">${SITE_URL.replace("https://", "")}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function adminEmailHTML(order: OrderRecord): string {
  const itemRows = buildItemRows(order.items);
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

        <!-- Header -->
        <tr>
          <td style="background:#2d2319;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;">🛒 New Order Received</h1>
          </td>
        </tr>

        <!-- Summary -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:8px;">
              <tr>
                <td style="padding:16px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#8b7355;font-size:13px;">Order</td>
                      <td style="text-align:right;color:#2d2319;font-weight:700;">${order.order_number}</td>
                    </tr>
                    <tr>
                      <td style="color:#8b7355;font-size:13px;padding-top:8px;">Customer</td>
                      <td style="text-align:right;color:#2d2319;">${order.customer_name}</td>
                    </tr>
                    <tr>
                      <td style="color:#8b7355;font-size:13px;padding-top:8px;">Email</td>
                      <td style="text-align:right;"><a href="mailto:${order.customer_email}" style="color:#8b5a2b;">${order.customer_email}</a></td>
                    </tr>
                    <tr>
                      <td style="color:#8b7355;font-size:13px;padding-top:8px;">Phone</td>
                      <td style="text-align:right;color:#2d2319;">${order.customer_phone}</td>
                    </tr>
                    <tr>
                      <td style="color:#8b7355;font-size:13px;padding-top:8px;">Items</td>
                      <td style="text-align:right;color:#2d2319;">${itemCount} item${itemCount > 1 ? "s" : ""}</td>
                    </tr>
                    <tr>
                      <td style="color:#8b7355;font-size:13px;padding-top:8px;">Total</td>
                      <td style="text-align:right;color:#8b5a2b;font-size:18px;font-weight:700;">${formatNaira(order.total)}</td>
                    </tr>
                    <tr>
                      <td style="color:#8b7355;font-size:13px;padding-top:8px;">Payment</td>
                      <td style="text-align:right;color:#2d2319;">${order.payment_method || "N/A"} &bull; ${order.payment_status || "pending"}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:0 32px 16px;">
            <h3 style="margin:0 0 12px;color:#2d2319;font-size:15px;">Items Ordered</h3>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <th style="padding:8px;text-align:left;color:#8b7355;font-size:12px;">Item</th>
                <th style="padding:8px;text-align:center;color:#8b7355;font-size:12px;">Qty</th>
                <th style="padding:8px;text-align:right;color:#8b7355;font-size:12px;">Price</th>
              </tr>
              ${itemRows}
            </table>
          </td>
        </tr>

        <!-- Delivery -->
        <tr>
          <td style="padding:0 32px 24px;">
            <h3 style="margin:0 0 8px;color:#2d2319;font-size:15px;">📦 Ship To</h3>
            <p style="margin:0;color:#5a4a3a;font-size:14px;line-height:1.6;">
              ${order.customer_name}<br>
              ${order.delivery_address}<br>
              ${order.delivery_city}, ${order.delivery_state}<br>
              📞 ${order.customer_phone}
            </p>
            ${order.notes ? `<p style="margin:8px 0 0;color:#8b7355;font-size:13px;"><strong>Notes:</strong> ${order.notes}</p>` : ""}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="${SITE_URL}/admin.html" style="display:inline-block;background:#2d2319;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
              Open Admin Panel
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px;text-align:center;border-top:1px solid #f0e6d8;">
            <p style="margin:0;color:#b8a898;font-size:12px;">${BRAND} &bull; ${formatDate(order.created_at)}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Status-Change Email Templates ──────────────

const STATUS_META: Record<
  string,
  { emoji: string; heading: string; message: string; color: string }
> = {
  processing: {
    emoji: "⚙️",
    heading: "Your order is being prepared!",
    message:
      "We're getting your items ready for shipment. You'll receive another notification when your order ships.",
    color: "#2196F3",
  },
  shipped: {
    emoji: "🚚",
    heading: "Your order is on its way!",
    message:
      "Your package has been shipped and is on its way to you. Delivery typically takes 2–5 business days.",
    color: "#FF9800",
  },
  delivered: {
    emoji: "✅",
    heading: "Your order has been delivered!",
    message:
      "We hope you love your new pieces! If you have any questions or concerns, don't hesitate to reach out.",
    color: "#4CAF50",
  },
  cancelled: {
    emoji: "❌",
    heading: "Your order has been cancelled",
    message:
      "Your order has been cancelled. If you were charged, a refund will be processed within 5–7 business days.",
    color: "#f44336",
  },
};

function statusUpdateEmailHTML(order: OrderRecord, newStatus: string): string {
  const meta = STATUS_META[newStatus] || {
    emoji: "📦",
    heading: `Order status: ${newStatus}`,
    message: `Your order status has been updated to "${newStatus}".`,
    color: "#8b5a2b",
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#8b5a2b,#a0724e);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">${BRAND}</h1>
          </td>
        </tr>

        <!-- Status Icon + Heading -->
        <tr>
          <td style="padding:32px 32px 8px;text-align:center;">
            <div style="font-size:48px;line-height:1;">${meta.emoji}</div>
            <h2 style="margin:16px 0 8px;color:#2d2319;font-size:22px;">${meta.heading}</h2>
            <p style="margin:0;color:#8b7355;font-size:15px;line-height:1.5;">${meta.message}</p>
          </td>
        </tr>

        <!-- Order Info Bar -->
        <tr>
          <td style="padding:16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:8px;">
              <tr>
                <td style="padding:16px;text-align:center;border-right:1px solid #f0e6d8;">
                  <span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Order</span><br>
                  <strong style="color:#2d2319;font-size:15px;">${order.order_number}</strong>
                </td>
                <td style="padding:16px;text-align:center;border-right:1px solid #f0e6d8;">
                  <span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Status</span><br>
                  <strong style="color:${meta.color};font-size:15px;text-transform:capitalize;">${newStatus}</strong>
                </td>
                <td style="padding:16px;text-align:center;">
                  <span style="color:#8b7355;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Total</span><br>
                  <strong style="color:#8b5a2b;font-size:15px;">${formatNaira(order.total)}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:16px 32px 32px;text-align:center;">
            <a href="${SITE_URL}/track.html?order=${encodeURIComponent(order.order_number)}" style="display:inline-block;background:#8b5a2b;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
              Track Your Order
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf8f5;padding:24px 32px;text-align:center;border-top:1px solid #f0e6d8;">
            <p style="margin:0 0 8px;color:#8b7355;font-size:13px;">
              Questions? Reply to this email or reach us at
              <a href="mailto:support@lingeriebysisioyin.store" style="color:#8b5a2b;">support@lingeriebysisioyin.store</a>
            </p>
            <p style="margin:0;color:#b8a898;font-size:12px;">
              &copy; ${new Date().getFullYear()} ${BRAND} &bull;
              <a href="${SITE_URL}" style="color:#8b7355;text-decoration:none;">${SITE_URL.replace("https://", "")}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send via Resend ────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${BRAND} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return { success: false, error: err };
    }

    const data = await res.json();
    console.log("Email sent:", data.id, "→", to);
    return { success: true };
  } catch (e) {
    console.error("Email send failed:", e);
    return { success: false, error: String(e) };
  }
}

// ── Edge Function Handler ──────────────────────

serve(async (req: Request) => {
  // Only accept POST (from the database webhook / trigger)
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();

    // The payload from a database webhook contains the new record
    // Format: { type: "INSERT"|"UPDATE", table: "orders", record: {...}, old_record: {...} }
    const eventType = payload.type || "INSERT";
    const order: OrderRecord = payload.record || payload;
    const oldRecord: Partial<OrderRecord> | undefined = payload.old_record;

    if (!order.order_number) {
      return new Response(JSON.stringify({ error: "Invalid order payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(
      `Processing ${eventType} email for order ${order.order_number}`,
    );

    const results: { customer?: string; admin?: string } = {};

    // ── STATUS UPDATE ──
    if (
      eventType === "UPDATE" &&
      oldRecord &&
      oldRecord.status !== order.status
    ) {
      const newStatus = order.status;
      console.log(`Status changed: ${oldRecord.status} → ${newStatus}`);

      // Send status update email to customer
      if (order.customer_email && STATUS_META[newStatus]) {
        const statusResult = await sendEmail(
          order.customer_email,
          `${STATUS_META[newStatus].emoji} Order ${order.order_number} — ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} | ${BRAND}`,
          statusUpdateEmailHTML(order, newStatus),
        );
        results.customer = statusResult.success
          ? "sent"
          : `failed: ${statusResult.error}`;
      } else {
        results.customer = order.customer_email
          ? `skipped (no template for "${newStatus}")`
          : "skipped (no email)";
      }

      // Notify admin of status change
      const adminResult = await sendEmail(
        ADMIN_EMAIL,
        `📋 Order ${order.order_number} → ${newStatus.toUpperCase()}`,
        `<p>Order <strong>${order.order_number}</strong> status changed from <strong>${oldRecord.status}</strong> to <strong>${newStatus}</strong>.</p><p><a href="${SITE_URL}/admin.html">Open Admin</a></p>`,
      );
      results.admin = adminResult.success
        ? "sent"
        : `failed: ${adminResult.error}`;

      return new Response(
        JSON.stringify({ success: true, event: "status_update", results }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ── NEW ORDER (INSERT) ──

    // 1. Send confirmation email to customer (if they provided an email)
    if (order.customer_email) {
      const customerResult = await sendEmail(
        order.customer_email,
        `Order Confirmed – ${order.order_number} | ${BRAND}`,
        customerEmailHTML(order),
      );
      results.customer = customerResult.success
        ? "sent"
        : `failed: ${customerResult.error}`;
    } else {
      results.customer = "skipped (no email)";
    }

    // 2. Send notification email to admin
    const adminResult = await sendEmail(
      ADMIN_EMAIL,
      `🛒 New Order ${order.order_number} – ${formatNaira(order.total)}`,
      adminEmailHTML(order),
    );
    results.admin = adminResult.success
      ? "sent"
      : `failed: ${adminResult.error}`;

    console.log("Email results:", results);

    return new Response(
      JSON.stringify({ success: true, event: "new_order", results }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
