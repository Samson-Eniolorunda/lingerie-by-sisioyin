"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors } from "@/schemas/auth";
import {
  inviteSchema,
  productDraftSchema,
  promoSchema,
  replySchema,
  settingsSchema,
} from "@/schemas/admin";
import { staffFor } from "@/server/auth/session";
import { data } from "@/server/data";
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
  status: OrderStatus,
): Promise<AdminState> {
  const actor = await guard("orders.update");
  if (!actor) return DENIED;
  const result = await data.admin.setOrderStatus(orderNumber, status, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The order has been updated." };
}

export async function paymentDecisionAction(
  orderNumber: string,
  decision: "confirmed" | "rejected",
): Promise<AdminState> {
  const actor = await guard("orders.update");
  if (!actor) return DENIED;
  const result = await data.admin.setPaymentDecision(orderNumber, decision, actor);
  if (!result.ok) return result;
  refresh();
  return {
    ok: true,
    message: decision === "confirmed" ? "Payment confirmed." : "The receipt was rejected.",
  };
}

/* Customers */

export async function customerStatusAction(
  id: string,
  status: "active" | "suspended" | "banned",
): Promise<AdminState> {
  const actor = await guard("customers.manage");
  if (!actor) return DENIED;
  const result = await data.admin.setCustomerStatus(id, status, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "The customer has been updated." };
}

export async function returnPrivilegeAction(id: string, allowed: boolean): Promise<AdminState> {
  const actor = await guard("customers.manage");
  if (!actor) return DENIED;
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

export async function promoActiveAction(id: string, active: boolean): Promise<AdminState> {
  const actor = await guard("promos.manage");
  if (!actor) return DENIED;
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

export async function markMessageAction(
  id: string,
  status: "read" | "unread",
): Promise<AdminState> {
  const actor = await guard("messages.manage");
  if (!actor) return DENIED;
  const result = await data.admin.markMessage(id, status);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function replyAction(id: string, input: unknown): Promise<AdminState> {
  const actor = await guard("messages.manage");
  if (!actor) return DENIED;
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await data.admin.replyToMessage(id, parsed.data.body, actor);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "Reply saved." };
}

export async function deleteMessageAction(id: string): Promise<AdminState> {
  const actor = await guard("messages.manage");
  if (!actor) return DENIED;
  const result = await data.admin.deleteMessage(id, actor);
  if (!result.ok) return result;
  refresh();
  redirect("/admin/messages");
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

export async function setStaffRoleAction(
  id: string,
  role: "super_admin" | "editor",
): Promise<AdminState> {
  const actor = await guard("roles.manage");
  if (!actor) return DENIED;
  const result = await data.admin.setStaffRole(id, role, actor);
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
