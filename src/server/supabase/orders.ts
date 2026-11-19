import type { OrderInput } from "@/schemas/checkout";
import type { OrdersRepository } from "@/server/data/contracts";
import { receipts } from "@/server/storage/receipts";
import { anonClient, serviceClient } from "./clients";
import { orderFromRow } from "./mappers";
import { failResult, must, okResult, TRY_AGAIN, valueResult } from "./util";

/** Order lines in the shape the SQL functions take. */
function sqlLines(lines: OrderInput["lines"]) {
  return lines.map((l) => ({
    product_id: l.id,
    size: l.selectedSize,
    colour: l.selectedColor,
    qty: l.qty,
  }));
}

interface Quoted {
  readonly ok: boolean;
  readonly message?: string;
  readonly subtotal?: number;
  readonly discount?: number;
  readonly delivery?: number;
  readonly total?: number;
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

async function orderByNumber(orderNumber: string) {
  const rows = must(
    await serviceClient().from("orders").select("*").eq("order_number", orderNumber).limit(1),
  );
  return rows[0] ? orderFromRow(rows[0]) : null;
}

/** The order could not be placed after the receipt was uploaded: staff see it and contact the customer. */
async function recordFailure(input: OrderInput, reason: string): Promise<void> {
  await serviceClient().rpc("record_checkout_failure", {
    p_key: input.idempotencyKey,
    p_receipt_path: input.receiptPath,
    p_name: `${input.contact.firstName} ${input.contact.lastName}`.trim(),
    p_email: input.contact.email,
    p_phone: input.contact.phone,
    p_total: input.quotedTotal,
    p_reason: reason,
  });
}

export const supabaseOrders: OrdersRepository = {
  async quote(input) {
    const { data, error } = await serviceClient().rpc("quote_order", {
      p_lines: sqlLines(input.lines),
      p_promo: input.promoCode ?? null,
      p_state: input.state,
    });
    if (error) return { ok: false, message: TRY_AGAIN };
    const q = data as Quoted;
    if (!q.ok) return { ok: false, message: q.message ?? TRY_AGAIN };
    return {
      ok: true,
      subtotal: Number(q.subtotal),
      discount: Number(q.discount),
      delivery: Number(q.delivery),
      total: Number(q.total),
    };
  },

  async place(input, context) {
    if (!input.receiptPath.startsWith(`${input.idempotencyKey}/`))
      return {
        ok: false,
        message: "Your receipt could not be matched to this order. Attach it again.",
      };
    if (!(await receipts.exists(input.receiptPath)))
      return {
        ok: false,
        message: "Your receipt did not finish uploading. Choose it again and place the order.",
      };

    // Only the server may place an order (the browser has no EXECUTE on place_order). It names the
    // signed-in customer, if any; the database refuses a receipt that is not in the bucket.
    const { data, error } = await serviceClient().rpc("place_order", {
      p_idempotency_key: input.idempotencyKey,
      p_contact: {
        name: `${input.contact.firstName} ${input.contact.lastName}`.trim(),
        email: input.contact.email,
        phone: input.contact.phone,
      },
      p_delivery: {
        address: input.delivery.address,
        city: input.delivery.city,
        state: input.delivery.state,
        landmark: input.delivery.landmark ?? "",
        notes: input.delivery.notes ?? "",
      },
      p_lines: sqlLines(input.lines),
      p_promo: input.promoCode ?? null,
      p_quoted_total: input.quotedTotal,
      p_receipt_path: input.receiptPath,
      p_user: context.userId,
    });
    if (error) return { ok: false, message: TRY_AGAIN };
    const result = data as {
      ok: boolean;
      code?: string;
      message?: string;
      order_number?: string;
      quote?: { total?: number } | null;
    };
    if (!result.ok || !result.order_number) {
      // The customer may already have paid: keep the receipt visible to staff (never silently lost).
      if (result.code !== "bad_key")
        await recordFailure(input, result.message ?? result.code ?? "");
      if (result.code === "total_changed" && result.quote?.total !== undefined)
        return {
          ok: false,
          changedTotal: Number(result.quote.total),
          message: `The total has changed to ${naira(Number(result.quote.total))}. Check the amount you transfer, then confirm again.`,
        };
      return { ok: false, message: result.message ?? TRY_AGAIN };
    }
    const order = await orderByNumber(result.order_number);
    return order ? { ok: true, order } : { ok: false, message: TRY_AGAIN };
  },

  async byNumber(orderNumber) {
    return orderByNumber(orderNumber.trim().toUpperCase());
  },

  async lookup(orderNumber, email) {
    const order = await orderByNumber(orderNumber.trim().toUpperCase());
    return order && order.email === email.trim().toLowerCase() ? order : null;
  },

  async attachReceipt(orderNumber, receiptPath) {
    const order = await orderByNumber(orderNumber);
    if (!order) return failResult("We could not find that order.");
    if (order.status !== "pending" || order.paymentStatus !== "rejected")
      return failResult("This order does not need another receipt.");
    if (order.receiptReuploadUntil && new Date(order.receiptReuploadUntil) < new Date())
      return failResult("The time to send another receipt has passed and the order was cancelled.");
    if (
      !receiptPath.startsWith(`${order.idempotencyKey}/`) ||
      !(await receipts.exists(receiptPath))
    )
      return failResult("Your receipt did not finish uploading. Choose it again.");
    // A guest cannot call this function (the SQL allows only the owner or the server), so the
    // server does, after the checks above.
    const { data, error } = await serviceClient().rpc("attach_receipt", {
      p_order_number: orderNumber,
      p_path: receiptPath,
    });
    if (error) return failResult(TRY_AGAIN);
    const result = data as { ok: boolean; message?: string };
    return result.ok ? okResult() : failResult(result.message ?? TRY_AGAIN);
  },

  async validatePromo(code) {
    const { data, error } = await anonClient().rpc("validate_promo", { p_code: code });
    const result = data as { valid?: boolean; code?: string; percent?: number } | null;
    if (error || !result?.valid || !result.code || result.percent === undefined)
      return failResult("That code is not valid, or it has expired.");
    return valueResult({ code: result.code, percent: Number(result.percent) });
  },

  async expireUnpaid() {
    const { data, error } = await serviceClient().rpc("expire_unpaid_orders");
    if (error) throw new Error(`Could not expire unpaid orders: ${error.message}`);
    return Number(data ?? 0);
  },
};
