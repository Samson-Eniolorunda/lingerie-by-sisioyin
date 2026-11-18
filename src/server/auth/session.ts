import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/permissions";
import { data } from "@/server/data";
import type { SessionUser } from "@/types/account";

export const CUSTOMER_COOKIE = "lbs_session";
export const STAFF_COOKIE = "lbs_staff_session";

type Audience = "customer" | "staff";

const cookieName = (audience: Audience) => (audience === "staff" ? STAFF_COOKIE : CUSTOMER_COOKIE);

/** The storefront and the admin keep separate sessions, so one never signs the other in (A-14). */
export async function setSessionCookie(audience: Audience, token: string): Promise<void> {
  (await cookies()).set(cookieName(audience), token, {
    httpOnly: true,
    sameSite: audience === "staff" ? "strict" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: audience === "staff" ? "/admin" : "/",
    maxAge: audience === "staff" ? 60 * 60 * 8 : 60 * 60 * 24 * 14,
  });
}

export async function clearSession(audience: Audience): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookieName(audience))?.value;
  await data.auth.signOut(token);
  jar.set(cookieName(audience), "", {
    path: audience === "staff" ? "/admin" : "/",
    maxAge: 0,
  });
}

export async function currentUser(audience: Audience = "customer"): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName(audience))?.value;
  return data.auth.userForToken(token, audience);
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
  if (!user) redirect(`/admin/sign-in?next=${encodeURIComponent(returnTo)}`);
  if (permission && !can(user.role, permission)) redirect("/admin/denied");
  return user;
}

/** For admin server actions: the actor, or null when the session is missing or lacks the permission. */
export async function staffFor(permission: Permission | null): Promise<SessionUser | null> {
  const user = await currentUser("staff");
  if (!user) return null;
  if (permission && !can(user.role, permission)) return null;
  return user;
}
