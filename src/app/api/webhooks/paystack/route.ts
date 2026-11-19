import type { NextResponse } from "next/server";
import { handleWebhook } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  return handleWebhook(request, "paystack");
}
