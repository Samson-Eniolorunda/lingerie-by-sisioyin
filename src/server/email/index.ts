import { CONTACT } from "@/config/site";
import { data } from "@/server/data";
import { siteOrigin } from "@/server/auth/request";
import type { StoredOrder } from "@/types/orders";
import * as templates from "./templates";
import { transport, type EmailMessage, type SendResult } from "./transport";

export { clearOutbox, outbox } from "./transport";

function context(): templates.MailContext {
  return {
    siteUrl: siteOrigin(),
    supportEmail: process.env.EMAIL_SUPPORT_ADDRESS || CONTACT.email,
    whatsappNumber: CONTACT.whatsappNumber,
  };
}

/**
 * Sends one message and never throws: an order, a payment decision or a reply has already been
 * saved by the time this runs, and a mail problem must not undo it or show the customer an error.
 * A failure is written to the server log (without the message body) so it can be followed up.
 */
export async function deliver(message: EmailMessage, kind: string): Promise<SendResult> {
  try {
    const result = await transport().send(message);
    if (!result.ok) process.stderr.write(`[email] ${kind} was not sent: ${result.reason}\n`);
    return result;
  } catch (error) {
    process.stderr.write(
      `[email] ${kind} failed: ${error instanceof Error ? error.message : "unknown"}\n`,
    );
    return { ok: false, reason: "unexpected error" };
  }
}

function to(address: string, rendered: templates.Rendered, replyTo?: string): EmailMessage {
  return { to: address, ...rendered, ...(replyTo ? { replyTo } : {}) };
}

const reply = () => process.env.EMAIL_SUPPORT_ADDRESS || CONTACT.email;

/** The customer's confirmation, and (when switched on in Settings) a note to the shop. */
export async function sendOrderPlaced(order: StoredOrder): Promise<void> {
  const ctx = context();
  const bank = await data.payments.bankDetails().catch(() => null);
  if (order.email)
    await deliver(
      to(order.email, templates.orderConfirmation(order, bank, ctx), reply()),
      "order confirmation",
    );
  const settings = await data.admin.settings().catch(() => null);
  if (settings?.notifyNewOrders)
    await deliver(
      to(settings.supportEmail || reply(), templates.newOrderAlert(order, ctx)),
      "new order alert",
    );
}

export async function sendPaymentConfirmed(order: StoredOrder): Promise<void> {
  if (order.email)
    await deliver(
      to(order.email, templates.paymentConfirmed(order, context()), reply()),
      "payment confirmed",
    );
}

export async function sendPaymentRejected(order: StoredOrder, reason?: string): Promise<void> {
  if (!order.email) return;
  const bank = await data.payments.bankDetails().catch(() => null);
  await deliver(
    to(
      order.email,
      templates.paymentRejected(order, bank, order.receiptReuploadUntil, context(), reason),
      reply(),
    ),
    "payment rejected",
  );
}

export async function sendOrderShipped(order: StoredOrder): Promise<void> {
  if (order.email)
    await deliver(
      to(order.email, templates.orderShipped(order, context()), reply()),
      "order shipped",
    );
}

export async function sendContactReply(input: {
  readonly to: string;
  readonly name: string;
  readonly subject: string;
  readonly original: string;
  readonly reply: string;
}): Promise<void> {
  await deliver(to(input.to, templates.contactReply(input, context()), reply()), "contact reply");
}
