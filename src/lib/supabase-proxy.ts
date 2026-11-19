import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Keeps a Supabase session alive. With the project's address and anon key configured, every request
 * passes through here: `getUser()` verifies the session with Supabase and, when the access token is
 * close to expiry, refreshes it and writes the new cookies onto both the request (so this render sees
 * them) and the response (so the browser keeps them), exactly as `@supabase/ssr` documents. With
 * nothing configured it does nothing and never contacts any service.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse,
  env: { readonly url?: string | undefined; readonly anonKey?: string | undefined },
): Promise<boolean> {
  if (!env.url || !env.anonKey) return false;
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  await supabase.auth.getUser();
  return true;
}
