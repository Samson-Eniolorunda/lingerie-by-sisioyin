import { DATA_MODE } from "@/config/data-mode";
import { TURNSTILE_FIELD, TURNSTILE_TEST_SECRET_KEY } from "@/lib/turnstile";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 4_000;
const MAX_TOKEN = 2_048;

export type TurnstileResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const FAILED = "We could not complete the security check. Please try again.";
const MISSING = "Please complete the security check before you continue.";
const UNAVAILABLE =
  "The security check is not available at the moment. Please try again in a few minutes.";

/** The token a form sent, or `undefined`. Reads the raw input so the form schemas stay unchanged. */
export function turnstileTokenOf(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[TURNSTILE_FIELD];
  return typeof value === "string" ? value : undefined;
}

type Secret = { readonly secret: string } | { readonly skip: true } | { readonly missing: string };

/**
 * Which secret applies here:
 * - the live site (`VERCEL_ENV=production`) needs the real key and fails closed without it;
 * - a Vercel preview uses Cloudflare's always-pass test key;
 * - the in-memory development store skips the check, as does any other machine with no key set.
 */
function secretForEnvironment(): Secret {
  const env = process.env.VERCEL_ENV;
  if (env === "production") {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    return secret ? { secret } : { missing: "TURNSTILE_SECRET_KEY" };
  }
  if (env === "preview") return { secret: TURNSTILE_TEST_SECRET_KEY };
  if (DATA_MODE === "mock") return { skip: true };
  const secret = process.env.TURNSTILE_SECRET_KEY;
  return secret ? { secret } : { skip: true };
}

/**
 * Asks Cloudflare whether a widget token is valid. Called by each form's server action before
 * anything is sent to Supabase or stored. A network failure or a timeout refuses the form: the
 * check is never skipped because Cloudflare could not be reached.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileResult> {
  const where = secretForEnvironment();
  if ("skip" in where) return { ok: true };
  if ("missing" in where) {
    // Fail closed, and say which variable to set (the one place a log line is wanted).
    process.stderr.write(`Turnstile is required here but ${where.missing} is not set.
`);
    return { ok: false, message: UNAVAILABLE };
  }
  if (!token || token.length > MAX_TOKEN) return { ok: false, message: MISSING };
  try {
    const body = new URLSearchParams({ secret: where.secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const response = await fetcher(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, message: UNAVAILABLE };
    const result = (await response.json()) as { success?: unknown };
    return result.success === true ? { ok: true } : { ok: false, message: FAILED };
  } catch {
    return { ok: false, message: UNAVAILABLE };
  }
}
