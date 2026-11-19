import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp } from "@/server/auth/request";
import { data } from "@/server/data";
import { allow } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const visitSchema = z.object({
  page: z.string().trim().min(1).max(300),
  referrer: z.string().max(300).optional(),
  deviceType: z.enum(["mobile", "tablet", "desktop"]).optional(),
  browser: z.string().max(40).optional(),
  os: z.string().max(40).optional(),
  screen: z.string().max(20).optional(),
  viewport: z.string().max(20).optional(),
});

/**
 * Records one page view for the analytics page, only ever called after the visitor accepted
 * analytics. The address and location are not taken from the browser and are not stored.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!allow(`visit:${await clientIp()}`, 120, 60_000))
    return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = visitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.page.startsWith("/"))
    return NextResponse.json({ ok: false }, { status: 400 });
  const id = await data.engagement.recordVisit(parsed.data);
  return NextResponse.json({ ok: id !== null, id }, { headers: { "Cache-Control": "no-store" } });
}

/** Time on page, reported once when the visitor leaves (`navigator.sendBeacon`). */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const parsed = z
    .object({ id: z.string().min(8).max(64), seconds: z.number().min(0).max(86_400) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  await data.engagement.visitDuration(parsed.data.id, parsed.data.seconds);
  return NextResponse.json({ ok: true });
}
