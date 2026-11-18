"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { receiptProblem, orderInputSchema, trackSchema } from "@/schemas/checkout";
import {
  findMockOrder,
  findPromo,
  getMockOrder,
  placeMockOrder,
  type StoredOrder,
} from "@/server/mock/orders";

export type PromoResult =
  | { readonly ok: true; readonly code: string; readonly percent: number }
  | { readonly ok: false; readonly message: string };

const promoSchema = z.string().trim().min(1, "Enter a promo code.").max(40);

/** Returns only validity and the percentage, never the list of codes (SEC-15). */
export async function applyPromo(input: string): Promise<PromoResult> {
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a promo code." };
  const promo = findPromo(parsed.data);
  if (!promo) return { ok: false, message: "That code is not valid, or it has expired." };
  return { ok: true, code: promo.code, percent: promo.percent };
}

export type PlaceOrderState =
  | { readonly ok: true; readonly orderNumber: string }
  | { readonly ok: false; readonly message: string; readonly fieldErrors?: Record<string, string> };

const LAST_ORDER_COOKIE = "lbs_last_order";

export async function placeOrder(formData: FormData): Promise<PlaceOrderState> {
  const raw = formData.get("payload");
  if (typeof raw !== "string")
    return { ok: false, message: "Something went wrong with the form. Please try again." };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Something went wrong with the form. Please try again." };
  }

  const parsed = orderInputSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, message: "Please check the highlighted details.", fieldErrors };
  }

  const receipt = formData.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    return {
      ok: false,
      message: "Attach your payment receipt to place the order.",
      fieldErrors: { receipt: "Attach your payment receipt." },
    };
  }
  const problem = receiptProblem(receipt);
  if (problem) return { ok: false, message: problem, fieldErrors: { receipt: problem } };

  const result = placeMockOrder(parsed.data);
  if (!result.ok) return { ok: false, message: result.message };

  (await cookies()).set(LAST_ORDER_COOKIE, result.order.orderNumber, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return { ok: true, orderNumber: result.order.orderNumber };
}

export async function lastOrder(): Promise<StoredOrder | null> {
  const number = (await cookies()).get(LAST_ORDER_COOKIE)?.value;
  if (!number) return null;
  return getMockOrder(number) ?? null;
}

export type TrackState =
  | { readonly ok: true; readonly order: StoredOrder }
  | { readonly ok: false; readonly message: string };

export async function trackOrder(input: { order: string; email: string }): Promise<TrackState> {
  const parsed = trackSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the details and try again.",
    };
  const order = findMockOrder(parsed.data.order, parsed.data.email);
  if (!order)
    return { ok: false, message: "We could not find an order with that number and email address." };
  return { ok: true, order };
}
