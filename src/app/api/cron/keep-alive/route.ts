import { NextResponse } from "next/server";
import { cronAuthorised, keepAlive } from "@/server/cron/keep-alive";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  if (!cronAuthorised(request.headers.get("authorization")))
    return NextResponse.json({ ok: false }, { status: 401 });
  const result = await keepAlive();
  return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
}
