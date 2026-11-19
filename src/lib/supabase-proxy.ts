import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { AUDIENCES, authCookieOptions } from "@/lib/supabase-cookies";

/**
 * Keeps Supabase sessions alive. With the project's address and anon key configured, every request
 * passes through here: `getUser()` verifies each session (customer and staff have their own
 * cookie) with Supabase and, when the access token is close to expiry, refreshes it and writes the
 * new cookies onto both the request (so this render sees them) and the response (so the browser
 * keeps them), as `@supabase/ssr` documents. A visitor with no auth cookie costs no network call.
 * With nothing configured it does nothing and never contacts any service.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse,
  env: { readonly url?: string | undefined; readonly anonKey?: string | undefined },
): Promise<boolean> {
  if (!env.url || !env.anonKey) return false;
  for (const audience of AUDIENCES) {
    const options = authCookieOptions(audience);
    const name = options.name ?? "";
    const present = request.cookies
      .getAll()
      .some((c) => c.name === name || c.name.startsWith(`${name}.`));
    if (!present) continue;
    const supabase = createServerClient(env.url, env.anonKey, {
      cookieOptions: options,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name: cookieName, value, options: cookieOptions } of cookies) {
            request.cookies.set(cookieName, value);
            response.cookies.set(cookieName, value, cookieOptions);
          }
        },
      },
    });
    await supabase.auth.getUser();
  }
  return true;
}
