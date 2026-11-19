import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { RESET_AUDIENCE_COOKIE } from "@/server/auth/request";
import { data } from "@/server/data";

export const dynamic = "force-dynamic";

/**
 * Where Supabase sends people after a password-recovery email, an address confirmation or Google
 * sign-in (`/auth/callback?code=...&next=...&aud=...`). The one-time code becomes a session of the
 * audience named by `aud` (the storefront or the admin), then the visitor goes on to `next` (a local
 * path only). A code that is missing, used or expired goes to the reset request page, except for a sign-up
 * confirmation, which goes to the sign-in page with a note that the address is confirmed.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"), "/");
  const audience = searchParams.get("aud") === "staff" ? "staff" : "customer";
  const code = searchParams.get("code");
  if (code) {
    const result = await data.auth.exchangeCode(code, audience);
    if (result.ok) {
      const response = NextResponse.redirect(new URL(next, origin));
      if (next.startsWith("/reset-password"))
        response.cookies.set(RESET_AUDIENCE_COOKIE, audience, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 30,
        });
      return response;
    }
  }
  // A sign-up confirmation opened in another browser or after the first click cannot be exchanged
  // for a session, but the address is already confirmed: tell the person to sign in.
  if (searchParams.get("type") === "confirm")
    return NextResponse.redirect(new URL("/sign-in?confirmed=1", origin));
  return NextResponse.redirect(new URL("/forgot-password?link=expired", origin));
}
