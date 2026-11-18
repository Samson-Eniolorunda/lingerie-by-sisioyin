import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";

/** Lets the static pages learn who is signed in without becoming dynamic themselves. */
export async function GET() {
  const user = await currentUser("customer");
  return NextResponse.json(
    user
      ? {
          signedIn: true,
          firstName: user.firstName,
          initials: `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase(),
        }
      : { signedIn: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
