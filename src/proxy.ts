import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, SECURITY_HEADERS } from "@/lib/csp";
import { refreshSupabaseSession } from "@/lib/supabase-proxy";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    isDev: process.env.NODE_ENV !== "production",
    upgradeInsecure: request.nextUrl.protocol === "https:",
  });

  // Built again by the refresh if the session cookies change, from the request that now holds them.
  const makeResponse = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  const response = await refreshSupabaseSession(request, makeResponse, {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  });
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons/).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
