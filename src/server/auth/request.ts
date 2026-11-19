import { headers } from "next/headers";
import { publicEnv } from "@/config/env";

/** The caller's network address as the platform reports it; used only to key sign-in throttling. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/**
 * The address of this deployment. On a Vercel preview it is the preview's own address (Vercel sets
 * `VERCEL_URL` per deployment), so links in e-mails bring people back to the preview they are testing;
 * everywhere else it is `NEXT_PUBLIC_SITE_URL`, which is set separately for Production (the live
 * domain) and Preview (see OWNER_SETUP.md).
 */
export function siteOrigin(): string {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`;
  return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/**
 * The absolute address Supabase sends people back to after an email or Google link. `confirm` marks
 * the link in a sign-up confirmation message, so a failed code exchange (the link opened in another
 * browser) can say the address is confirmed instead of showing the reset page.
 */
export function callbackUrl(
  next: string,
  audience: "customer" | "staff" = "customer",
  kind?: "confirm",
): string {
  const type = kind ? `&type=${kind}` : "";
  return `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}&aud=${audience}${type}`;
}

/** Set by `/auth/callback` after a recovery link, so the new password goes to the right account. */
export const RESET_AUDIENCE_COOKIE = "lbs_reset_aud";
