import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, SECURITY_HEADERS } from "@/lib/csp";

export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    isDev: process.env.NODE_ENV !== "production",
    upgradeInsecure: request.nextUrl.protocol === "https:",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
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
