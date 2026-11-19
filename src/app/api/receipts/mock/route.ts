import { NextResponse, type NextRequest } from "next/server";
import { DATA_MODE } from "@/config/data-mode";
import { MAX_RECEIPT_BYTES, isReceiptType } from "@/lib/receipt-types";
import { saveMockReceipt } from "@/server/storage/receipts";

/** Stands in for a signed Supabase Storage upload address while the shop runs on the development store. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (DATA_MODE !== "mock") return new NextResponse(null, { status: 404 });
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const type = request.headers.get("content-type") ?? "";
  if (!/^[A-Za-z0-9-]{16,64}\/[A-Za-z0-9-]+\.[a-z]{3,4}$/.test(path) || !isReceiptType(type))
    return NextResponse.json({ error: "That upload is not allowed." }, { status: 400 });
  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_RECEIPT_BYTES)
    return NextResponse.json({ error: "That file is too large or empty." }, { status: 413 });
  saveMockReceipt(path, { type, size: body.byteLength });
  return NextResponse.json({ ok: true });
}
