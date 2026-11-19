import { adminPath } from "@/lib/adminPath";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/permissions";
import { data } from "@/server/data";
import type { SessionUser } from "@/types/account";

type Audience = "customer" | "staff";

export async function clearSession(audience: Audience): Promise<void> {
  await data.auth.signOut(audience);
}

export async function currentUser(audience: Audience = "customer"): Promise<SessionUser | null> {
  return data.auth.currentUser(audience);
}

/** For account pages: sends a signed-out visitor to sign in and back again. */
export async function requireCustomer(returnTo: string): Promise<SessionUser> {
  const user = await currentUser("customer");
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** For admin pages: no session goes to the staff sign-in, a session without the permission to a plain notice. */
export async function requireStaff(
  permission: Permission | null,
  returnTo: string,
): Promise<SessionUser> {
  const user = await currentUser("staff");
  if (!user) redirect(adminPath(`/sign-in?next=${encodeURIComponent(returnTo)}`));
  if (permission && !can(user.role, permission)) redirect(adminPath("/denied"));
  return user;
}

/** For admin server actions: the actor, or null when the session is missing or lacks the permission. */
export async function staffFor(permission: Permission | null): Promise<SessionUser | null> {
  const user = await currentUser("staff");
  if (!user) return null;
  if (permission && !can(user.role, permission)) return null;
  return user;
}
