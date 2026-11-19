import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * The storefront and the admin keep separate sessions, so signing in to one never signs in the
 * other. Each audience has its own cookie name and its own lifetime. Shared by the server clients, the proxy and the callback so they all agree.
 */
export type Audience = "customer" | "staff";
export const AUDIENCES: readonly Audience[] = ["customer", "staff"];

export const AUTH_COOKIE: Readonly<Record<Audience, string>> = {
  customer: "lbs-auth",
  staff: "lbs-staff-auth",
};

export function authCookieOptions(audience: Audience): CookieOptionsWithName {
  return {
    name: AUTH_COOKIE[audience],
    // Both lax and site-wide: the recovery link arrives from an email (a cross-site navigation) at
    // /auth/callback, which must see the PKCE verifier cookie set when the link was requested.
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: audience === "staff" ? 60 * 60 * 8 : 60 * 60 * 24 * 14,
  };
}
