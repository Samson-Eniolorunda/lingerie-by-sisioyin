"use server";

import { adminPath } from "@/lib/adminPath";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { fieldErrors } from "@/schemas/auth";
import {
  bankDetailsSchema,
  customerStatusSchema,
  inviteSchema,
  messageMarkSchema,
  orderStatusSchema,
  paymentDecisionSchema,
  paymentMethodSchema,
  productDraftSchema,
  promoSchema,
  receivedAmountSchema,
  replySchema,
  settingsSchema,
  staffRoleSchema,
} from "@/schemas/admin";
import { staffFor } from "@/server/auth/session";
import { data } from "@/server/data";
import {
  sendContactReply,
  sendOrderShipped,
  sendPaymentConfirmed,
  sendPaymentRejected,
} from "@/server/email";
import type { Permission } from "@/lib/permissions";
import type { OrderStatus, SessionUser } from "@/types/account";

export type AdminState =
  | { readonly ok: true; readonly message?: string; readonly link?: string }
  | { readonly ok: false; readonly message: string; readonly fieldErrors?: Record<string, string> };

const DENIED: AdminState = {
  ok: false,
  message: "You do not have permission to do that, or your session has ended.",
};

async function guard(permission: Permission): Promise<SessionUser | null> {
  return staffFor(permission);
}

const BAD_REQUEST: AdminState = {
  ok: false,
  message: "That request was not understood. Please reload the page and try again.",
};

const refresh = () => revalidatePath("/admin", "layout");

function invalid(error: Parameters<typeof fieldErrors>[0]): AdminState {
  return {
    ok: false,
    message: "Please check the highlighted details.",
    fieldErrors: fieldErrors(error),
  };
}

/* Products */

export async function saveProductAction(id: string | null, input: unknown): Promise<AdminState> {
  const actor = await guard("products.manage");
  if (!actor) return DENIED;
  const parsed = productDraftSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = id
    ? await data.admin.updateProduct(id, parsed.data, actor)
    : await data.admin.createProduct(parsed.data, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: id ? "Product saved." : "Product added." };
}

export async function trashProductsAction(ids: readonly string[]): Promise<AdminState> {
  const actor = await guard("products.manage");
  if (!actor) return DENIED;
  for (const id of ids) {
    const result = await data.admin.trashProduct(id, actor);
    if (!result.ok) return result;
  }
  refresh();
  return {
    ok: true,
    message:
      ids.length === 1 ? "Moved to the trash." : `${ids.length} products moved to the trash.`,
  };
}

export async function restoreProductsAction(ids: readonly string[]): Promise<AdminState> {
  const actor = await guard("products.manage");
  if (!actor) return DENIED;
  for (const id of ids) {
    const result = await data.admin.restoreProduct(id, actor);
    if (!result.ok) return result;
  }
  refresh();
  return { ok: true, message: "Restored." };
}

export async function deleteProductForeverAction(id: string): Promise<AdminState> {
  const actor = await guard("roles.manage");
  if (!actor) return DENIED;
  const result = await data.admin.deleteProductForever(id, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "Deleted for good." };
}

export async function emptyTrashAction(): Promise<AdminState> {
  const actor = await guard("roles.manage");
  if (!actor) return DENIED;
  const result = await data.admin.emptyTrash(actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The trash is empty." };
}

/* Orders */

export async function setOrderStatusAction(
  orderNumber: string,
  status: unknown,
): Promise<AdminState> {
  const actor = await guard("orders.update");
  if (!actor) return DENIED;
  const parsed = orderStatusSchema.safeParse(status);
  if (!parsed.success) return BAD_REQUEST;
  const result = await data.admin.setOrderStatus(orderNumber, parsed.data as OrderStatus, actor);
  if (!result.ok) return result;
  if (parsed.data === "shipped")
    after(async () => {
      const order = await data.admin.order(orderNumber);
      if (order) await sendOrderShipped(order);
    });
  refresh();
  return { ok: true, message: "The order has been updated." };
}

export async function paymentDecisionAction(
  orderNumber: string,
  decision: unknown,
  reason?: unknown,
): Promise<AdminState> {
  const actor = await guard("orders.update");
  if (!actor) return DENIED;
  const parsed = paymentDecisionSchema.safeParse(decision);
  // The optional reason goes to the customer in the rejection e-mail; short, plain text.
  const why = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
  if (!parsed.success) return BAD_REQUEST;
  const result = await data.admin.setPaymentDecision(orderNumber, parsed.data, actor);
  if (!result.ok) return result;
  after(async () => {
    const order = await data.admin.order(orderNumber);
    if (!order) return;
    if (parsed.data === "confirmed") await sendPaymentConfirmed(order);
    else await sendPaymentRejected(order, why);
  });
  refresh();
  return {
    ok: true,
    message:
      parsed.data === "confirmed"
        ? "Payment confirmed."
        : "The receipt was rejected. The customer has 48 hours to send another.",
  };
}

/** Refunds: a cancelled order with an unaccepted receipt is checked against the bank, then refunded if money arrived. */
export async function resolveRefundCheckAction(
  orderNumber: string,
  received: unknown,
  confirmOver = false,
): Promise<AdminState> {
  const actor = await guard("orders.update");
  if (!actor) return DENIED;
  const parsed = receivedAmountSchema.safeParse(received);
  if (!parsed.success)
    return { ok: false, message: "Enter the amount that reached the account, in naira." };
  const result = await data.admin.resolveRefundCheck(
    orderNumber,
    parsed.data,
    actor,
    confirmOver === true,
  );
  if (!result.ok) return result;
  refresh();
  return {
    ok: true,
    message: parsed.data > 0 ? "A refund is now recorded as owed." : "Recorded: no money arrived.",
  };
}

export async function markRefundedAction(orderNumber: string): Promise<AdminState> {
  const actor = await guard("orders.update");
  if (!actor) return DENIED;
  const result = await data.admin.markRefunded(orderNumber, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The refund is recorded as paid." };
}

/** Receipts with no order: customers who paid but whose order failed, and abandoned uploads. */
export async function closeCheckoutFailureAction(
  id: string,
  resolution: unknown,
): Promise<AdminState> {
  const actor = await guard("orders.update");
  if (!actor) return DENIED;
  const parsed = z.string().trim().max(300).safeParse(resolution);
  if (!parsed.success) return BAD_REQUEST;
  const result = await data.admin.resolveCheckoutFailure(id, parsed.data, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The failed checkout is closed." };
}

export async function deleteOrphanReceiptAction(path: string): Promise<AdminState> {
  const actor = await guard("orders.update");
  if (!actor) return DENIED;
  if (typeof path !== "string" || path.length === 0 || path.length > 300 || path.includes(".."))
    return BAD_REQUEST;
  const result = await data.admin.deleteOrphanReceipt(path, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The receipt was deleted." };
}

/* Reviews and testimonials (moderation) */

export async function setReviewApprovedAction(id: string, approved: unknown): Promise<AdminState> {
  const actor = await guard("products.manage");
  if (!actor) return DENIED;
  if (typeof approved !== "boolean") return BAD_REQUEST;
  const result = await data.admin.setReviewApproved(id, approved, actor);
  if (!result.ok) return result;
  refresh();
  revalidatePath("/products", "layout");
  return { ok: true, message: approved ? "The review is now shown." : "The review is hidden." };
}

export async function deleteReviewAction(id: string): Promise<AdminState> {
  const actor = await guard("products.manage");
  if (!actor) return DENIED;
  const result = await data.admin.deleteReview(id, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The review was deleted." };
}

export async function setTestimonialAction(id: string, change: unknown): Promise<AdminState> {
  const actor = await guard("products.manage");
  if (!actor) return DENIED;
  const parsed = z
    .object({ approved: z.boolean().optional(), featured: z.boolean().optional() })
    .safeParse(change);
  if (!parsed.success) return BAD_REQUEST;
  const result = await data.admin.setTestimonial(
    id,
    {
      ...(parsed.data.approved !== undefined ? { approved: parsed.data.approved } : {}),
      ...(parsed.data.featured !== undefined ? { featured: parsed.data.featured } : {}),
    },
    actor,
  );
  if (!result.ok) return result;
  refresh();
  revalidatePath("/", "layout");
  return { ok: true, message: "The testimonial was updated." };
}

export async function deleteTestimonialAction(id: string): Promise<AdminState> {
  const actor = await guard("products.manage");
  if (!actor) return DENIED;
  const result = await data.admin.deleteTestimonial(id, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The testimonial was deleted." };
}

/* Customers */

export async function customerStatusAction(id: string, status: unknown): Promise<AdminState> {
  const actor = await guard("customers.manage");
  if (!actor) return DENIED;
  const parsed = customerStatusSchema.safeParse(status);
  if (!parsed.success) return BAD_REQUEST;
  const result = await data.admin.setCustomerStatus(id, parsed.data, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The customer has been updated." };
}

export async function returnPrivilegeAction(id: string, allowed: unknown): Promise<AdminState> {
  const actor = await guard("customers.manage");
  if (!actor) return DENIED;
  if (typeof allowed !== "boolean") return BAD_REQUEST;
  const result = await data.admin.setReturnPrivilege(id, allowed, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: allowed ? "Returns restored." : "Returns revoked." };
}

export async function deleteCustomerAction(id: string): Promise<AdminState> {
  const actor = await guard("customers.manage");
  if (!actor) return DENIED;
  const result = await data.admin.deleteCustomer(id, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The customer's data has been deleted." };
}

/* Promos */

export async function savePromoAction(input: unknown): Promise<AdminState> {
  const actor = await guard("promos.manage");
  if (!actor) return DENIED;
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await data.admin.savePromo(parsed.data, actor);
  if (!result.ok)
    return { ok: false, message: result.message, fieldErrors: { code: result.message } };
  refresh();
  return { ok: true, message: "Promo code created." };
}

export async function promoActiveAction(id: string, active: unknown): Promise<AdminState> {
  const actor = await guard("promos.manage");
  if (!actor) return DENIED;
  if (typeof active !== "boolean") return BAD_REQUEST;
  const result = await data.admin.setPromoActive(id, active, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: active ? "Promo code switched on." : "Promo code switched off." };
}

export async function deletePromoAction(id: string): Promise<AdminState> {
  const actor = await guard("promos.manage");
  if (!actor) return DENIED;
  const result = await data.admin.deletePromo(id, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "Promo code deleted." };
}

/* Messages */

export async function markMessageAction(id: string, status: unknown): Promise<AdminState> {
  const actor = await guard("messages.manage");
  if (!actor) return DENIED;
  const parsed = messageMarkSchema.safeParse(status);
  if (!parsed.success) return BAD_REQUEST;
  const result = await data.admin.markMessage(id, parsed.data, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function replyAction(id: string, input: unknown): Promise<AdminState> {
  const actor = await guard("messages.manage");
  if (!actor) return DENIED;
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const original = await data.admin.message(id);
  const result = await data.admin.replyToMessage(id, parsed.data.body, actor);
  if (!result.ok) return result;
  if (original)
    after(() =>
      sendContactReply({
        to: original.email,
        name: original.name,
        subject: original.subject,
        original: original.body,
        reply: parsed.data.body,
      }),
    );
  refresh();
  return { ok: true, message: "Reply saved and e-mailed to the customer." };
}

export async function deleteMessageAction(id: string): Promise<AdminState> {
  const actor = await guard("messages.manage");
  if (!actor) return DENIED;
  const result = await data.admin.deleteMessage(id, actor);
  if (!result.ok) return result;
  refresh();
  redirect(adminPath("/messages"));
}

/* Settings, roles and invitations */

export async function saveSettingsAction(input: unknown): Promise<AdminState> {
  const actor = await guard("settings.manage");
  if (!actor) return DENIED;
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await data.admin.saveSettings(parsed.data, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "Settings saved." };
}

export async function saveBankDetailsAction(input: unknown): Promise<AdminState> {
  const actor = await guard("settings.manage");
  if (!actor) return DENIED;
  const parsed = bankDetailsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await data.admin.saveBankDetails(parsed.data, actor);
  if (!result.ok) return result;
  refresh();
  revalidatePath("/", "layout");
  return { ok: true, message: "Bank details saved. Checkout now shows them." };
}

export async function setPaymentMethodAction(
  method: unknown,
  enabled: unknown,
): Promise<AdminState> {
  const actor = await guard("settings.manage");
  if (!actor) return DENIED;
  const parsed = paymentMethodSchema.safeParse({ method, enabled });
  if (!parsed.success) return BAD_REQUEST;
  const result = await data.admin.setPaymentMethod(parsed.data.method, parsed.data.enabled, actor);
  if (!result.ok) return result;
  refresh();
  return {
    ok: true,
    message: parsed.data.enabled ? "Payment method switched on." : "Payment method switched off.",
  };
}

export async function setStaffRoleAction(id: string, role: unknown): Promise<AdminState> {
  const actor = await guard("roles.manage");
  if (!actor) return DENIED;
  const parsed = staffRoleSchema.safeParse(role);
  if (!parsed.success) return BAD_REQUEST;
  const result = await data.admin.setStaffRole(id, parsed.data, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "Role changed." };
}

export async function removeStaffAction(id: string): Promise<AdminState> {
  const actor = await guard("roles.manage");
  if (!actor) return DENIED;
  const result = await data.admin.removeStaff(id, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "Access removed." };
}

export async function inviteStaffAction(input: unknown): Promise<AdminState> {
  const actor = await guard("roles.manage");
  if (!actor) return DENIED;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await data.admin.inviteStaff(parsed.data.email, parsed.data.role, actor);
  if (!result.ok) return result;
  refresh();
  return {
    ok: true,
    message: "Invitation created. Send this link to the new member of staff.",
    link: result.value.link,
  };
}
