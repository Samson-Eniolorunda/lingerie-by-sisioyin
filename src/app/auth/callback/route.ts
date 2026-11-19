import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { data } from "@/server/data";

export const dynamic = "force-dynamic";

/**
 * Where Supabase sends people after a password-recovery email or Google sign-in
 * (`/auth/callback?code=...&next=...`). The one-time code becomes a session, then the visitor goes on
 * to `next` (a local path only). A code that is missing, used or expired goes to the reset request page.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"), "/");
  const code = searchParams.get("code");
  if (code) {
    const result = await data.auth.exchangeCode(code);
    if (result.ok) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/forgot-password?link=expired", origin));
}
