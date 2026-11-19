import { NextResponse } from "next/server";
import { cronAuthorised } from "@/server/cron/keep-alive";
import { data } from "@/server/data";

export const dynamic = "force-dynamic";

/** Cancels orders whose rejected receipt was not replaced in time, putting their stock back on sale. */
export async function GET(request: Request): Promise<NextResponse> {
  if (!cronAuthorised(request.headers.get("authorization")))
    return NextResponse.json({ ok: false }, { status: 401 });
  const cancelled = await data.orders.expireUnpaid();
  return NextResponse.json({ ok: true, cancelled });
}
