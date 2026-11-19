/** The Turnstile widget script and its frame; loaded only on pages that have a form with the check. */
const TURNSTILE = "https://challenges.cloudflare.com";

export interface CspOptions {
  readonly nonce: string;
  readonly supabaseUrl?: string | undefined;
  readonly isDev: boolean;
  /** Only when the page itself is served over HTTPS, so a local production build still loads. */
  readonly upgradeInsecure?: boolean;
}

/**
 * Content security policy with a per-request nonce and no `'unsafe-inline'` for scripts.
 * Analytics, Cloudflare Turnstile and Supabase hosts are listed explicitly; they load only after consent
 * or when a sheet that needs them opens.
 */
export function buildCsp({
  nonce,
  supabaseUrl,
  isDev,
  upgradeInsecure = false,
}: CspOptions): string {
  const supabase = supabaseUrl ? [new URL(supabaseUrl).origin, wsOrigin(supabaseUrl)] : [];
  const directives: Record<string, readonly string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      TURNSTILE,
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://*.supabase.co",
      "https://res.cloudinary.com",
      "https://www.google-analytics.com",
      "https://www.facebook.com",
    ],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      ...supabase,
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://www.facebook.com",
    ],
    "frame-src": [TURNSTILE],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .concat(upgradeInsecure ? ["upgrade-insecure-requests"] : [])
    .join("; ");
}

function wsOrigin(url: string): string {
  const origin = new URL(url);
  return `wss://${origin.host}`;
}

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
};
