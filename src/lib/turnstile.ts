/**
 * Cloudflare Turnstile settings shared by the server and the browser. The keys below are the ones
 * Cloudflare publishes for testing: they always pass. They are used on Vercel previews only,
 * because preview hostnames are not on the widget's list of domains.
 */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

/** Field name under which a form sends the widget's token to its server action. */
export const TURNSTILE_FIELD = "turnstileToken";

/**
 * The site key the widget should use, or `null` when there is none (a developer's machine and the
 * automated tests, where the check is skipped). Each variable is read by name so the bundler can
 * inline it for the browser.
 */
export function turnstileSiteKey(): string | null {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV;
  if (env === "preview") return TURNSTILE_TEST_SITE_KEY;
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
}
