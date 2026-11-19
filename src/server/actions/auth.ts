"use server";

import { redirect } from "next/navigation";
import { fieldErrors, forgotSchema, resetSchema, signInSchema, signUpSchema } from "@/schemas/auth";
import { safeNext } from "@/lib/safe-next";
import { callbackUrl, clientIp } from "@/server/auth/request";
import { clearSession } from "@/server/auth/session";
import { data } from "@/server/data";

export type AuthState =
  | {
      readonly ok: true;
      readonly message?: string;
      readonly devLink?: string;
      readonly url?: string;
    }
  | { readonly ok: false; readonly message: string; readonly fieldErrors: Record<string, string> };

const invalid = (message: string, errors: Record<string, string> = {}): AuthState => ({
  ok: false,
  message,
  fieldErrors: errors,
});

export async function signInAction(input: unknown, next: string | null): Promise<AuthState> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success)
    return invalid("Please check the highlighted details.", fieldErrors(parsed.error));
  const result = await data.auth.signIn(parsed.data.email, parsed.data.password, "customer", {
    ip: await clientIp(),
  });
  if (!result.ok) return invalid(result.message);
  redirect(safeNext(next, "/dashboard"));
}

export async function signUpAction(input: unknown, next: string | null): Promise<AuthState> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success)
    return invalid("Please check the highlighted details.", fieldErrors(parsed.error));
  const { firstName, lastName, email, password } = parsed.data;
  const result = await data.auth.signUp({ firstName, lastName, email, password });
  if (!result.ok) return invalid(result.message, { email: result.message });
  redirect(safeNext(next, "/dashboard"));
}

export async function googleAction(): Promise<AuthState> {
  const result = await data.auth.signInWithGoogle(callbackUrl("/dashboard"));
  return result.ok ? { ok: true, url: result.value.url } : invalid(result.message);
}

export async function forgotAction(input: unknown): Promise<AuthState> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return invalid("Enter a valid email address.", fieldErrors(parsed.error));
  const { devLink } = await data.auth.requestPasswordReset(
    parsed.data.email,
    "customer",
    callbackUrl("/reset-password"),
  );
  // The reply is the same whether or not the address has an account (M-23).
  return {
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
    ...(devLink ? { devLink } : {}),
  };
}

export async function resetAction(input: unknown): Promise<AuthState> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success)
    return invalid("Please check the highlighted details.", fieldErrors(parsed.error));
  const result = await data.auth.updatePassword(parsed.data.password);
  if (!result.ok) return invalid(result.message);
  return { ok: true, message: "Your password has been changed. Sign in with the new one." };
}

export async function signOutAction(): Promise<void> {
  await clearSession("customer");
  redirect("/");
}

export async function staffSignInAction(input: unknown, next: string | null): Promise<AuthState> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success)
    return invalid("Kindly enter your login details.", fieldErrors(parsed.error));
  const result = await data.auth.signIn(parsed.data.email, parsed.data.password, "staff", {
    ip: await clientIp(),
  });
  if (!result.ok) return invalid(result.message);
  redirect(safeNext(next, "/admin"));
}

export async function staffSignOutAction(): Promise<void> {
  await clearSession("staff");
  redirect("/admin/sign-in");
}

export async function staffForgotAction(input: unknown): Promise<AuthState> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return invalid("Enter a valid email address.", fieldErrors(parsed.error));
  const { devLink } = await data.auth.requestPasswordReset(
    parsed.data.email,
    "staff",
    callbackUrl("/reset-password"),
  );
  return {
    ok: true,
    message: "If that address has a staff account, a reset link is on its way.",
    ...(devLink ? { devLink } : {}),
  };
}
