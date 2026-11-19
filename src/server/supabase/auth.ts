import { cache } from "react";
import { AUDIENCES, type Audience } from "@/lib/supabase-cookies";
import { callbackUrl } from "@/server/auth/request";
import { clearAllFor, clearFailures, isLocked, noteFailure } from "@/server/auth/throttle";
import type { AuthRepository } from "@/server/data/contracts";
import type { SessionUser, StaffRole } from "@/types/account";
import { freshClient, serviceClient, sessionClient } from "./clients";
import { failResult, okResult, valueResult } from "./util";

const GENERIC = "The email or password is not correct.";
const CLOSED = "This account has been closed. Please contact us if you think this is a mistake.";
const SUSPENDED = "This account is suspended. Please contact us on WhatsApp.";

interface ProfileRow {
  readonly id: string;
  readonly email: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly role: string;
  readonly account_status: string;
}

function toSessionUser(row: ProfileRow): SessionUser {
  return {
    id: row.id,
    email: row.email ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    role: row.role === "customer" ? null : (row.role as StaffRole),
  };
}

/** Reads the profile with the server key so a suspended or banned account can be told apart from a missing one. */
async function profileRow(id: string): Promise<ProfileRow | null> {
  const { data } = await serviceClient()
    .from("profiles")
    .select("id,email,first_name,last_name,role,account_status")
    .eq("id", id)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

/** The verified session for an audience, as a user; `null` when there is none, or it does not qualify. */
const loadUser = cache(async (audience: Audience): Promise<SessionUser | null> => {
  const client = await sessionClient(audience);
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  const row = await profileRow(data.user.id);
  if (!row || row.account_status !== "active") return null;
  if (audience === "staff" && row.role === "customer") return null;
  return toSessionUser(row);
});

export const supabaseAuth: AuthRepository = {
  async signIn(email, password, audience, context) {
    if (isLocked(email, context.ip))
      return failResult("Too many attempts. Please wait ten minutes, or reset your password.");
    const client = await sessionClient(audience);
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) {
      if (error?.code === "user_banned") return failResult(CLOSED);
      if (error?.code === "email_not_confirmed")
        return failResult(
          "Please confirm your email address first. We sent you a link when you signed up.",
        );
      noteFailure(email, context.ip);
      return failResult(GENERIC);
    }
    clearFailures(email, context.ip);
    const row = await profileRow(data.user.id);
    const deny = async (message: string) => {
      await client.auth.signOut({ scope: "local" });
      return failResult<SessionUser>(message);
    };
    if (!row || row.account_status === "deleted") return deny(GENERIC);
    if (row.account_status === "suspended") return deny(SUSPENDED);
    if (row.account_status === "banned") return deny(CLOSED);
    if (audience === "staff" && row.role === "customer")
      return deny("Access denied. This sign-in is for staff only.");
    if (audience === "customer") await client.rpc("claim_guest_orders");
    return valueResult(toSessionUser(row));
  },

  async signUp(input) {
    const client = await sessionClient("customer");
    const { data, error } = await client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          full_name: `${input.firstName} ${input.lastName}`.trim(),
        },
        emailRedirectTo: callbackUrl("/dashboard"),
      },
    });
    const exists = "An account with this email already exists. Sign in instead.";
    if (error) return failResult(error.code === "user_already_exists" ? exists : error.message);
    // With confirmation on, an address that already has an account comes back with no identities.
    if (data.user && (data.user.identities?.length ?? 1) === 0) return failResult(exists);
    if (!data.session || !data.user) return valueResult<SessionUser | null>(null);
    const row = await profileRow(data.user.id);
    return valueResult<SessionUser | null>(row ? toSessionUser(row) : null);
  },

  async signInWithGoogle(redirectTo) {
    const client = await sessionClient("customer");
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url)
      return failResult(
        "Google sign-in is not available right now. Please use your email instead.",
      );
    return valueResult({ url: data.url });
  },

  async requestPasswordReset(email, audience, redirectTo) {
    const client = await sessionClient(audience);
    // The answer never says whether the address has an account.
    await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    return { devLink: null };
  },

  async exchangeCode(code, audience) {
    const client = await sessionClient(audience);
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user)
      return failResult("This link has expired or has already been used. Request a new one.");
    const row = await profileRow(data.user.id);
    if (!row || row.account_status !== "active") {
      await client.auth.signOut({ scope: "local" });
      return failResult("This link is not valid.");
    }
    if (audience === "staff" && row.role === "customer") {
      await client.auth.signOut({ scope: "local" });
      return failResult("This link is not valid.");
    }
    await client.rpc("claim_guest_orders");
    return okResult();
  },

  async updatePassword(password, audience) {
    const client = await sessionClient(audience);
    const { data: current } = await client.auth.getUser();
    if (!current.user) return failResult("This link has expired. Request a new one.");
    const { error } = await client.auth.updateUser({ password });
    if (error)
      return failResult(
        error.code === "same_password"
          ? "Choose a password you have not used before."
          : error.code === "weak_password"
            ? "That password is too weak. Choose a longer one."
            : "Your password could not be changed. Request a new link and try again.",
      );
    // Every session of this person ends, here and elsewhere; they sign in again with the new one.
    await client.auth.signOut({ scope: "global" });
    if (current.user.email) clearAllFor(current.user.email);
    return okResult();
  },

  async confirmPassword(email, password) {
    const probe = freshClient();
    const { data, error } = await probe.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.session) return false;
    await probe.auth.signOut({ scope: "local" });
    return true;
  },

  async currentUser(audience) {
    return loadUser(audience);
  },

  async refreshSession() {
    for (const audience of AUDIENCES) {
      const client = await sessionClient(audience);
      await client.auth.getUser();
    }
  },

  async signOut(audience) {
    const client = await sessionClient(audience);
    await client.auth.signOut({ scope: "local" });
  },
};
