"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { isReceiptType, receiptProblem } from "@/lib/receipt-types";
import {
  orderInputSchema,
  quoteSchema,
  receiptUploadSchema,
  trackSchema,
} from "@/schemas/checkout";
import { clientIp } from "@/server/auth/request";
import { currentUser } from "@/server/auth/session";
import { data } from "@/server/data";
import { allowRequest, allowShared } from "@/server/rate-limit";
import { newReceiptPath, receipts, type ReceiptUpload } from "@/server/storage/receipts";
import { trackedOrder, type Quote, type StoredOrder, type TrackedOrder } from "@/types/orders";

export type PromoResult =
  | { readonly ok: true; readonly code: string; readonly percent: number }
  | { readonly ok: false; readonly message: string };

const promoSchema = z.string().trim().min(1, "Enter a promo code.").max(40);

/** Returns only validity and the percentage, never the list of codes (SEC-15). */
export async function applyPromo(input: string): Promise<PromoResult> {
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a promo code." };
  const result = await data.orders.validatePromo(parsed.data);
  return result.ok ? { ok: true, ...result.value } : { ok: false, message: result.message };
}

export type QuoteState =
  ({ readonly ok: true } & Quote) | { readonly ok: false; readonly message: string };

/** What to transfer: priced on the server, asked for before the bank details are shown. */
export async function getQuote(input: unknown): Promise<QuoteState> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check your bag and delivery.",
    };
  return data.orders.quote(parsed.data);
}

export type UploadState =
  ({ readonly ok: true } & ReceiptUpload) | { readonly ok: false; readonly message: string };

const UPLOAD_LIMIT = 20;
const HOUR = 3_600_000;

async function issueUpload(scope: string, type: string, size: number): Promise<UploadState> {
  const problem = receiptProblem({ type, size });
  if (problem || !isReceiptType(type))
    return { ok: false, message: problem ?? "Attach a photograph or a PDF of your receipt." };
  if (!(await allowShared(`upload:${await clientIp()}`, UPLOAD_LIMIT, HOUR)))
    return {
      ok: false,
      message: "Too many uploads from this connection. Please wait a little and try again.",
    };
  return { ok: true, ...(await receipts.createUpload(newReceiptPath(scope, type), type)) };
}

/** A signed address for the browser to upload the receipt to directly; no file passes through this action. */
export async function createReceiptUpload(input: unknown): Promise<UploadState> {
  const parsed = receiptUploadSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Something went wrong with the form. Please try again." };
  return issueUpload(parsed.data.idempotencyKey, parsed.data.type, parsed.data.size);
}

export type PlaceOrderState =
  | { readonly ok: true; readonly orderNumber: string }
  | {
      readonly ok: false;
      readonly message: string;
      readonly fieldErrors?: Record<string, string>;
      readonly changedTotal?: number;
    };

const RECEIPT_SAFE =
  "If you have already paid, please do not pay again: we have your receipt and, if the order cannot be completed, we will contact you and refund you in full.";

const LAST_ORDER_COOKIE = "lbs_last_order";

export async function placeOrder(input: unknown): Promise<PlaceOrderState> {
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, message: "Please check the highlighted details.", fieldErrors };
  }

  // Shared limit by address and by e-mail: a script cannot hold stock or burn promo codes by
  // placing orders in a loop (each attempt counts, successful or not).
  if (
    !(await allowRequest("order", await clientIp(), [parsed.data.contact.email], {
      ip: 10,
      subject: 5,
      windowMs: HOUR,
    }))
  )
    return {
      ok: false,
      message: "Too many orders from this connection. Please wait a little and try again.",
    };

  const user = await currentUser("customer");
  const result = await data.orders.place(parsed.data, { userId: user?.id ?? null });
  if (!result.ok)
    return {
      ok: false,
      // The transfer has usually been made by now, so never say that nothing was charged.
      message: `${result.message} ${RECEIPT_SAFE}`,
      ...(result.changedTotal !== undefined ? { changedTotal: result.changedTotal } : {}),
    };

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
  return data.orders.byNumber(number);
}

export type TrackState =
  | { readonly ok: true; readonly order: TrackedOrder }
  | { readonly ok: false; readonly message: string };

const LOOKUP_LIMITED = "Too many attempts. Please wait a few minutes and try again.";

/** Order numbers can be guessed, so every look-up by number and e-mail is limited per address and per e-mail. */
async function limitLookups(email: string): Promise<boolean> {
  return allowRequest("lookup", await clientIp(), [email], {
    ip: 30,
    subject: 10,
    windowMs: 15 * 60_000,
  });
}

export async function trackOrder(input: { order: string; email: string }): Promise<TrackState> {
  const parsed = trackSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the details and try again.",
    };
  if (!(await limitLookups(parsed.data.email))) return { ok: false, message: LOOKUP_LIMITED };
  const order = await data.orders.lookup(parsed.data.order, parsed.data.email);
  if (!order)
    return { ok: false, message: "We could not find an order with that number and email address." };
  return { ok: true, order: trackedOrder(order) };
}

const reuploadSchema = z.object({
  order: trackSchema.shape.order,
  email: trackSchema.shape.email,
  type: z.string().max(60),
  size: z.number().int().min(1),
});

/** An upload address for a replacement receipt, for the person who can prove the order (number and email). */
export async function createReceiptReupload(input: unknown): Promise<UploadState> {
  const parsed = reuploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the order number and email." };
  if (!(await limitLookups(parsed.data.email))) return { ok: false, message: LOOKUP_LIMITED };
  const order = await data.orders.lookup(parsed.data.order, parsed.data.email);
  if (!order) return { ok: false, message: "We could not find that order." };
  return issueUpload(order.idempotencyKey, parsed.data.type, parsed.data.size);
}

const attachSchema = z.object({
  order: trackSchema.shape.order,
  email: trackSchema.shape.email,
  path: z.string().min(1).max(200),
});

export async function attachReceipt(
  input: unknown,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the order number and email." };
  if (!(await limitLookups(parsed.data.email))) return { ok: false, message: LOOKUP_LIMITED };
  const order = await data.orders.lookup(parsed.data.order, parsed.data.email);
  if (!order) return { ok: false, message: "We could not find that order." };
  return data.orders.attachReceipt(order.orderNumber, parsed.data.path);
}
