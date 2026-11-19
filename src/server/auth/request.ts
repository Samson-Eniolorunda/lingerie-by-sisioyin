import { headers } from "next/headers";
import { publicEnv } from "@/config/env";

const PRODUCTION_HOST = "www.lingeriebysisioyin.store";

/**
 * The caller's network address, used only to key throttling. Vercel's own headers come first: they
 * are set by Vercel from the connection it received and cannot be supplied by the caller. The
 * general `x-forwarded-for` is the last resort (local development).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const vercel = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const real = h.get("x-real-ip")?.trim();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return vercel || real || forwarded || "unknown";
}

/**
 * The address of this deployment, for links that do not depend on the request (e-mails sent after
 * the response). On a Vercel preview it is the preview's own address; everywhere else it is
 * `NEXT_PUBLIC_SITE_URL` (Production only; see OWNER_SETUP.md).
 */
export function siteOrigin(): string {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`;
  return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/**
 * Whether a host may appear in a link we e-mail: the production domain, this project's own
 * `*.vercel.app` addresses (the deployment, its branch alias, or the project's name as the prefix),
 * or localhost. A forged `Host` header can therefore never point a reset link somewhere else.
 */
export function hostAllowed(host: string): boolean {
  const name = host.toLowerCase().split(":")[0] ?? "";
  if (!name) return false;
  if (name === "localhost" || name === "127.0.0.1") return true;
  try {
    if (name === new URL(publicEnv.NEXT_PUBLIC_SITE_URL).hostname.toLowerCase()) return true;
  } catch {
    // an unusable site address allows nothing extra
  }
  if (name === PRODUCTION_HOST) return true;
  for (const own of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL])
    if (own && name === own.toLowerCase()) return true;
  const slug = process.env.VERCEL_GIT_REPO_SLUG?.toLowerCase();
  const project = process.env.VERCEL_PROJECT_NAME?.toLowerCase() ?? slug;
  return Boolean(
    project &&
    name.endsWith(".vercel.app") &&
    name.startsWith(`${project}-`) &&
    /^[a-z0-9.-]+$/.test(name),
  );
}

/**
 * The address to send people back to from an auth e-mail. On a preview it is the request's own host
 * (so a reset link works through the branch alias the tester is using) when the allow-list accepts
 * it, otherwise the preview's own address. Production and local development use the configured site.
 */
export async function requestOrigin(): Promise<string> {
  if (process.env.VERCEL_ENV !== "preview") return siteOrigin();
  let host = "";
  try {
    const h = await headers();
    host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]?.trim() ?? "";
  } catch {
    // Outside a request there is no host to follow.
  }
  if (host && hostAllowed(host)) {
    const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    return `${local ? "http" : "https"}://${host}`;
  }
  return siteOrigin();
}

/**
 * The absolute address Supabase sends people back to after an email or Google link. `confirm` marks
 * the link in a sign-up confirmation message, so a failed code exchange (the link opened in another
 * browser) can say the address is confirmed instead of showing the reset page.
 */
export async function callbackUrl(
  next: string,
  audience: "customer" | "staff" = "customer",
  kind?: "confirm",
): Promise<string> {
  const type = kind ? `&type=${kind}` : "";
  return `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}&aud=${audience}${type}`;
}

/** Set by `/auth/callback` after a recovery link, so the new password goes to the right account. */
export const RESET_AUDIENCE_COOKIE = "lbs_reset_aud";
