import { NextResponse } from "next/server";
import { adminPath } from "@/lib/adminPath";
import { staffFor } from "@/server/auth/session";
import { data } from "@/server/data";
import { receipts } from "@/server/storage/receipts";

/**
 * Opens one receipt for a member of staff. Under /admin so the staff cookie is sent. Opening is
 * recorded first (a receipt nobody has opened can never be deleted), then the person is sent to a
 * short-lived signed link; the file itself is never public.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const actor = await staffFor("orders.view");
  if (!actor) return NextResponse.redirect(new URL(adminPath("/sign-in"), request.url), 303);
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (path.length === 0 || path.length > 300 || path.includes(".."))
    return NextResponse.json(
      { ok: false, message: "That receipt was not found." },
      { status: 400 },
    );
  const rows = await data.admin.orphanReceipts();
  if (!rows.some((r) => r.path === path))
    return NextResponse.json(
      { ok: false, message: "That receipt was not found." },
      { status: 404 },
    );
  const marked = await data.admin.markReceiptViewed(path, actor);
  if (!marked.ok) return NextResponse.json(marked, { status: 500 });
  const link = await receipts.link(path);
  return NextResponse.redirect(new URL(link.url, request.url), 303);
}
