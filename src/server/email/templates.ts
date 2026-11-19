import { formatNaira } from "@/lib/money";
import { DELIVERY_STATES } from "@/lib/delivery";
import { bankSummary } from "@/lib/bank-details";
import type { BankDetails } from "@/types/account";
import type { StoredOrder } from "@/types/orders";

/**
 * The e-mails the shop sends, in British English. Each template is a pure function of its data and
 * returns the subject, an HTML body (inline styles, one column, 600 pixels, readable without
 * images) and a plain-text body. Every value that came from a customer is escaped.
 */
export interface Rendered {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface MailContext {
  readonly siteUrl: string;
  readonly supportEmail: string;
  readonly whatsappNumber: string;
}

const BRAND = "Lingeries by Sisioyin";
const INK = "#2a2026";
const MUTED = "#6b5f66";
const LINE = "#e8dfe3";
const ACCENT = "#7a2e4d";

export function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(ctx: MailContext, heading: string, body: string, preheader: string): string {
  return `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f6f2f4;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2f4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};font-family:Georgia,'Times New Roman',serif;color:${INK};">
<tr><td style="padding:24px 28px;border-bottom:1px solid ${LINE};font-size:22px;letter-spacing:0.5px;color:${ACCENT};">${esc(BRAND)}</td></tr>
<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${INK};">
<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:normal;color:${INK};">${esc(heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};">
Questions? Reply to this e-mail, write to <a href="mailto:${esc(ctx.supportEmail)}" style="color:${ACCENT};">${esc(ctx.supportEmail)}</a>
or message us on <a href="https://wa.me/${esc(ctx.whatsappNumber)}" style="color:${ACCENT};">WhatsApp</a>.<br>
${esc(BRAND)} · <a href="${esc(ctx.siteUrl)}" style="color:${ACCENT};">${esc(ctx.siteUrl.replace(/^https?:\/\//, ""))}</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 14px;">${text}</p>`;

function linesTable(order: StoredOrder): string {
  const rows = order.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};">${esc(l.name)}<br><span style="color:${MUTED};font-size:14px;">${esc([l.size, l.colour].filter(Boolean).join(" · "))} × ${l.qty}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid ${LINE};white-space:nowrap;">${formatNaira(l.unitPriceNgn * l.qty)}</td></tr>`,
    )
    .join("");
  const sum = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;${strong ? "font-weight:bold;" : `color:${MUTED};`}">${label}</td><td align="right" style="padding:4px 0;${strong ? "font-weight:bold;" : ""}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">${rows}
${sum("Subtotal", formatNaira(order.subtotal))}
${order.discount > 0 ? sum(`Discount${order.promoCode ? ` (${esc(order.promoCode)})` : ""}`, `−${formatNaira(order.discount)}`) : ""}
${sum("Delivery", order.delivery === 0 ? "Free" : formatNaira(order.delivery))}
${sum("Total", formatNaira(order.total), true)}</table>`;
}

function linesText(order: StoredOrder): string {
  return [
    ...order.lines.map(
      (l) =>
        `- ${l.name} (${[l.size, l.colour].filter(Boolean).join(", ")}) x ${l.qty}: ${formatNaira(l.unitPriceNgn * l.qty)}`,
    ),
    `Subtotal: ${formatNaira(order.subtotal)}`,
    ...(order.discount > 0 ? [`Discount: -${formatNaira(order.discount)}`] : []),
    `Delivery: ${order.delivery === 0 ? "Free" : formatNaira(order.delivery)}`,
    `Total: ${formatNaira(order.total)}`,
  ].join("\n");
}

function stateLabel(order: StoredOrder): string {
  return DELIVERY_STATES.find((s) => s.id === order.state)?.label ?? order.state;
}

function bankBlock(bank: BankDetails | null): { html: string; text: string } {
  if (!bank)
    return {
      html: p("Payment details are being updated. We will write to you with them shortly."),
      text: "Payment details are being updated. We will write to you with them shortly.",
    };
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid ${LINE};width:100%;"><tr><td style="padding:12px 14px;font-size:15px;line-height:1.7;">
<strong>Bank:</strong> ${esc(bank.bankName)}<br><strong>Account number:</strong> ${esc(bank.accountNumber)}<br><strong>Account name:</strong> ${esc(bank.accountName)}${bank.note ? `<br><em>${esc(bank.note)}</em>` : ""}</td></tr></table>`,
    text: `${bankSummary(bank)}${bank.note ? `\n${bank.note}` : ""}`,
  };
}

const firstName = (order: StoredOrder) => order.customerName.split(" ")[0] || "there";

export function orderConfirmation(
  order: StoredOrder,
  bank: BankDetails | null,
  ctx: MailContext,
): Rendered {
  const pay = bankBlock(bank);
  const html = layout(
    ctx,
    `Thank you, ${firstName(order)}. We have your order.`,
    [
      p(
        `Your order number is <strong>${esc(order.orderNumber)}</strong>. We have your payment receipt and will check it against our account as soon as we can; you will hear from us again once it is confirmed.`,
      ),
      linesTable(order),
      p(
        `<strong>Delivery to:</strong> ${esc(order.address)}, ${esc(order.city)}, ${esc(stateLabel(order))}`,
      ),
      p(
        `If you have not yet sent <strong>${formatNaira(order.total)}</strong>, please transfer it to:`,
      ),
      pay.html,
      p(
        `You can follow this order at any time on our <a href="${esc(ctx.siteUrl)}/track?order=${encodeURIComponent(order.orderNumber)}" style="color:${ACCENT};">tracking page</a> with your order number and this e-mail address. You may cancel it online within 30 minutes of placing it, while it is still awaiting payment confirmation.`,
      ),
    ].join("\n"),
    `Order ${order.orderNumber}: we have your order and your receipt.`,
  );
  const text = `Thank you, ${firstName(order)}. We have your order.\n\nOrder number: ${order.orderNumber}\n\n${linesText(order)}\n\nDelivery to: ${order.address}, ${order.city}, ${stateLabel(order)}\n\nIf you have not yet sent ${formatNaira(order.total)}, please transfer it to:\n${pay.text}\n\nTrack your order: ${ctx.siteUrl}/track?order=${encodeURIComponent(order.orderNumber)}\n\n${BRAND}`;
  return { subject: `Your order ${order.orderNumber} · ${BRAND}`, html, text };
}

export function paymentConfirmed(order: StoredOrder, ctx: MailContext): Rendered {
  const html = layout(
    ctx,
    "Your payment is confirmed",
    [
      p(
        `Dear ${esc(firstName(order))}, we have confirmed your payment of <strong>${formatNaira(order.total)}</strong> for order <strong>${esc(order.orderNumber)}</strong>. We are now preparing it, and will write again when it is on its way.`,
      ),
      linesTable(order),
    ].join("\n"),
    `Payment confirmed for order ${order.orderNumber}.`,
  );
  const text = `Dear ${firstName(order)},\n\nWe have confirmed your payment of ${formatNaira(order.total)} for order ${order.orderNumber}. We are now preparing it, and will write again when it is on its way.\n\n${linesText(order)}\n\n${BRAND}`;
  return { subject: `Payment confirmed for order ${order.orderNumber}`, html, text };
}

export function paymentRejected(
  order: StoredOrder,
  bank: BankDetails | null,
  deadline: string | null,
  ctx: MailContext,
): Rendered {
  const pay = bankBlock(bank);
  const until = deadline
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(new Date(deadline))
    : null;
  const html = layout(
    ctx,
    "We could not confirm your payment",
    [
      p(
        `Dear ${esc(firstName(order))}, we were unable to match the receipt you sent for order <strong>${esc(order.orderNumber)}</strong> with a payment of <strong>${formatNaira(order.total)}</strong> in our account.`,
      ),
      p(
        `Please send a clear photograph or PDF of your receipt${until ? ` by <strong>${esc(until)}</strong>` : ""}, from the <a href="${esc(ctx.siteUrl)}/track?order=${encodeURIComponent(order.orderNumber)}" style="color:${ACCENT};">tracking page</a>. If the order is not paid by then it will be cancelled and the items returned to stock. If you have not yet paid, the details are:`,
      ),
      pay.html,
      p(
        "If you believe this is a mistake, please reply to this e-mail and we will look into it at once.",
      ),
    ].join("\n"),
    `We could not confirm the payment for order ${order.orderNumber}.`,
  );
  const text = `Dear ${firstName(order)},\n\nWe were unable to match the receipt you sent for order ${order.orderNumber} with a payment of ${formatNaira(order.total)} in our account.\n\nPlease send a clear photograph or PDF of your receipt${until ? ` by ${until}` : ""} from ${ctx.siteUrl}/track?order=${encodeURIComponent(order.orderNumber)}. If the order is not paid by then it will be cancelled. Payment details:\n${pay.text}\n\nIf you believe this is a mistake, please reply to this e-mail.\n\n${BRAND}`;
  return { subject: `Action needed: payment for order ${order.orderNumber}`, html, text };
}

export function orderShipped(order: StoredOrder, ctx: MailContext): Rendered {
  const html = layout(
    ctx,
    "Your order is on its way",
    [
      p(
        `Dear ${esc(firstName(order))}, order <strong>${esc(order.orderNumber)}</strong> has been dispatched to ${esc(order.city)}, ${esc(stateLabel(order))}. Please keep your phone nearby: the rider may call ${esc(order.phone)} to arrange delivery.`,
      ),
      linesTable(order),
      p(
        `We hope you enjoy it. If anything is not right, please reply to this e-mail within seven days of delivery.`,
      ),
    ].join("\n"),
    `Order ${order.orderNumber} has been dispatched.`,
  );
  const text = `Dear ${firstName(order)},\n\nOrder ${order.orderNumber} has been dispatched to ${order.city}, ${stateLabel(order)}. Please keep your phone nearby: the rider may call ${order.phone} to arrange delivery.\n\n${linesText(order)}\n\nIf anything is not right, please reply to this e-mail within seven days of delivery.\n\n${BRAND}`;
  return { subject: `Order ${order.orderNumber} is on its way`, html, text };
}

export function contactReply(
  input: { name: string; subject: string; original: string; reply: string },
  ctx: MailContext,
): Rendered {
  const paragraphs = input.reply
    .split(/\n{2,}/)
    .map((para) => p(esc(para).replaceAll("\n", "<br>")))
    .join("\n");
  const html = layout(
    ctx,
    `Re: ${input.subject}`,
    [
      p(`Dear ${esc(input.name.split(" ")[0] || "there")},`),
      paragraphs,
      p("Kind regards,<br>The team at " + esc(BRAND)),
      `<blockquote style="margin:18px 0 0;padding:8px 14px;border-left:3px solid ${LINE};color:${MUTED};font-size:14px;">${esc(input.original).replaceAll("\n", "<br>")}</blockquote>`,
    ].join("\n"),
    `A reply to your message: ${input.subject}`,
  );
  const text = `Dear ${input.name.split(" ")[0] || "there"},\n\n${input.reply}\n\nKind regards,\nThe team at ${BRAND}\n\n> ${input.original.replaceAll("\n", "\n> ")}`;
  return { subject: `Re: ${input.subject}`, html, text };
}

/** To the shop itself, when "tell me when a new order arrives" is on. */
export function newOrderAlert(order: StoredOrder, ctx: MailContext): Rendered {
  const html = layout(
    ctx,
    `New order ${order.orderNumber}`,
    [
      p(
        `${esc(order.customerName)} placed an order for <strong>${formatNaira(order.total)}</strong>. A receipt is waiting to be checked.`,
      ),
      p(
        `<a href="${esc(ctx.siteUrl)}/admin/orders/${encodeURIComponent(order.orderNumber)}" style="color:${ACCENT};">Open the order</a>`,
      ),
    ].join("\n"),
    `New order ${order.orderNumber}: ${formatNaira(order.total)}.`,
  );
  const text = `${order.customerName} placed order ${order.orderNumber} for ${formatNaira(order.total)}. A receipt is waiting to be checked.\n${ctx.siteUrl}/admin/orders/${order.orderNumber}`;
  return { subject: `New order ${order.orderNumber} (${formatNaira(order.total)})`, html, text };
}
