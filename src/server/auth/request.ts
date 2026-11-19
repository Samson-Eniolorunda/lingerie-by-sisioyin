import { headers } from "next/headers";
import { publicEnv } from "@/config/env";

/** The caller's network address as the platform reports it; used only to key sign-in throttling. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/** The absolute address Supabase sends people back to after an email or Google link. */
export function callbackUrl(next: string, audience: "customer" | "staff" = "customer"): string {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/auth/callback?next=${encodeURIComponent(next)}&aud=${audience}`;
}

/** Set by `/auth/callback` after a recovery link, so the new password goes to the right account. */
export const RESET_AUDIENCE_COOKIE = "lbs_reset_aud";
