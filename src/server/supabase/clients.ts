import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { authCookieOptions, type Audience } from "@/lib/supabase-cookies";

/**
 * The three ways the server talks to Supabase. Names of environment variables only; the values
 * live in the host's settings and never in the repository.
 *
 * - `anonClient()`: the public key, no session. Catalogue, promo checks, contact form: what any
 *   visitor may do. Row level security is the boundary.
 * - `sessionClient(audience)`: the public key plus the visitor's own session from the cookie
 *   written by `@supabase/ssr`. Everything done "as the customer" or "as the member of staff".
 * - `serviceClient()`: the service role key, which bypasses row level security. Server only, used
 *   sparingly: guest order look-ups, receipts, the expiry job, closing an account, bans.
 */

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return url;
}

function anonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.");
  return key;
}

const stateless = { auth: { persistSession: false, autoRefreshToken: false } } as const;

let anon: SupabaseClient | undefined;
export function anonClient(): SupabaseClient {
  anon ??= createClient(supabaseUrl(), anonKey(), stateless);
  return anon;
}

/** A throwaway client with its own in-memory state, for one sign-in probe that must not leak a session. */
export function freshClient(): SupabaseClient {
  return createClient(supabaseUrl(), anonKey(), stateless);
}

let service: SupabaseClient | undefined;
export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  service ??= createClient(supabaseUrl(), key, stateless);
  return service;
}

/** A fresh client per call: it reads this request's cookies and may write renewed ones. */
export async function sessionClient(audience: Audience): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(supabaseUrl(), anonKey(), {
    cookieOptions: authCookieOptions(audience),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // A Server Component cannot write cookies; the proxy renews the session instead.
        }
      },
    },
    auth: { flowType: "pkce" },
  });
}
