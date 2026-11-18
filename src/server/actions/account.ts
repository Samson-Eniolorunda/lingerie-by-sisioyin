"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addressSchema, fieldErrors, profileSchema } from "@/schemas/auth";
import { clearSession, currentUser } from "@/server/auth/session";
import { data } from "@/server/data";

export type ActionState =
  | { readonly ok: true; readonly message?: string }
  | { readonly ok: false; readonly message: string; readonly fieldErrors?: Record<string, string> };

const SIGNED_OUT: ActionState = {
  ok: false,
  message: "Your session has ended. Please sign in again.",
};

export async function updateProfileAction(input: unknown): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Please check the highlighted details.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const result = await data.account.updateProfile(user.id, parsed.data);
  if (!result.ok) return result;
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Your profile has been saved." };
}

export async function saveAddressAction(input: unknown, id: string | null): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Please check the highlighted details.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const result = await data.account.saveAddress(user.id, parsed.data, id ?? undefined);
  if (!result.ok) return result;
  revalidatePath("/dashboard/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddressAction(id: string): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;
  const result = await data.account.deleteAddress(user.id, id);
  if (!result.ok) return result;
  revalidatePath("/dashboard/addresses");
  return { ok: true, message: "Address deleted." };
}

export async function cancelOrderAction(orderNumber: string): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;
  const result = await data.account.cancelOrder(user.id, orderNumber);
  if (!result.ok) return result;
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Your order has been cancelled." };
}

export async function exportDataAction(): Promise<{ readonly ok: boolean; readonly text: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, text: "" };
  return { ok: true, text: await data.account.exportData(user.id) };
}

/** A request, not an immediate erasure: the shop completes it by hand and confirms by email (decision 9.6). */
export async function requestDeletionAction(password: string): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;
  if (password.length === 0)
    return {
      ok: false,
      message: "Enter your password to confirm.",
      fieldErrors: { password: "Enter your password to confirm." },
    };
  const result = await data.account.requestDeletion(user.id, password);
  if (!result.ok)
    return { ok: false, message: result.message, fieldErrors: { password: result.message } };
  await clearSession("customer");
  redirect("/?account=deletion-requested");
}

export async function changePasswordLinkAction(): Promise<{ readonly devLink: string | null }> {
  const user = await currentUser();
  if (!user) return { devLink: null };
  const { devToken } = await data.auth.requestPasswordReset(user.email, "customer");
  return { devLink: devToken ? `/reset-password?token=${devToken}` : null };
}
