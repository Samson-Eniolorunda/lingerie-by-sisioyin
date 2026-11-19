import { computeTotals } from "@/lib/pricing";
import { formatOrderNumber } from "@/lib/order-number";
import { lookupVariant } from "@/lib/variants";
import type { OrderInput } from "@/schemas/checkout";
import type { OrdersRepository } from "@/server/data/contracts";
import { receipts } from "@/server/storage/receipts";
import type { PromoRecord } from "@/types/account";
import type { Product } from "@/types/domain";
import type { PlaceOrderResult, Quote, StoredLine, StoredOrder } from "@/types/orders";
import { getDb, resetDb, type Db } from "./db";

/**
 * Development order store, held in memory. It follows the database functions the baseline defines
 * (`quote_order`, `place_order`, `cancel_order`, `decide_payment`): prices and stock are re-read
 * from the catalogue, the exact variant is required and decremented, the promo is counted, the total
 * is checked against the quoted one, and a repeated idempotency key returns the same order.
 */

export const REUPLOAD_HOURS = 48;

function activeProduct(db: Db, id: string): Product | undefined {
  return db.products.find((p) => p.id === id && p.deletedAt === null && p.active);
}

export function resetMockStore(): void {
  resetDb();
}

/** A code is usable when it is on, inside its dates and under its usage limit. */
export function findPromo(code: string, now = new Date()): PromoRecord | null {
  const promo = getDb().promos.find((p) => p.code === code.trim().toUpperCase());
  if (!promo || !promo.active) return null;
  if (promo.expiresAt && new Date(promo.expiresAt) < now) return null;
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) return null;
  return promo;
}

function decrement(p: Product, size: string, colour: string, qty: number): Product {
  const variantStock = p.variantStock.map((v) =>
    v.size === size && v.color === colour ? { ...v, qty: v.qty - qty } : v,
  );
  const sizes = p.sizes.map((s) =>
    s.name === size && s.qty !== undefined ? { ...s, qty: s.qty - qty } : s,
  );
  return { ...p, qty: p.qty - qty, variantStock, sizes };
}

/** Puts the units of a cancelled order back on the shelf, per exact variant, and gives back the promo use. */
export function restoreStock(db: Db, order: StoredOrder): void {
  for (const line of order.lines) {
    const index = db.products.findIndex((p) => p.id === line.productId);
    const product = db.products[index];
    if (!product) continue;
    db.products[index] = {
      ...product,
      qty: product.qty + line.qty,
      variantStock: product.variantStock.map((v) =>
        v.size === line.size && v.color === line.colour ? { ...v, qty: v.qty + line.qty } : v,
      ),
      sizes: product.sizes.map((s) =>
        s.name === line.size && s.qty !== undefined ? { ...s, qty: s.qty + line.qty } : s,
      ),
    };
  }
  if (order.promoCode) {
    const index = db.promos.findIndex((p) => p.code === order.promoCode);
    const promo = db.promos[index];
    if (promo && promo.usedCount > 0)
      db.promos[index] = { ...promo, usedCount: promo.usedCount - 1 };
  }
}

/**
 * The one cancellation path (customer, staff and the expiry job). It only acts on an order that is
 * not already cancelled, so stock is never restored twice; cancelling a paid order records that a
 * refund is owed.
 */
export function applyCancellation(db: Db, order: StoredOrder, now: Date): StoredOrder | null {
  const current = db.orders.get(order.orderNumber);
  if (!current || current.status === "cancelled" || current.status === "delivered") return null;
  restoreStock(db, current);
  const cancelled: StoredOrder = {
    ...current,
    status: "cancelled",
    paymentStatus: current.paymentStatus === "confirmed" ? "refund_owed" : current.paymentStatus,
    receiptReuploadUntil: null,
    updatedAt: now.toISOString(),
  };
  db.orders.set(current.orderNumber, cancelled);
  return cancelled;
}

interface Priced {
  readonly lines: StoredLine[];
  readonly totals: Quote;
  readonly promo: PromoRecord | null;
  readonly working: Map<string, Product>;
}

function price(
  db: Db,
  input: {
    readonly lines: OrderInput["lines"];
    readonly promoCode?: string | undefined;
    readonly state: string;
  },
  now: Date,
): Priced | { readonly message: string } {
  const working = new Map<string, Product>();
  const lines: StoredLine[] = [];

  for (const line of input.lines) {
    const current = working.get(line.id) ?? activeProduct(db, line.id);
    if (!current)
      return {
        message: "One of the items in your bag is no longer sold. Remove it and try again.",
      };
    const found = lookupVariant(current, line.selectedSize, line.selectedColor);
    if (!found.ok) {
      if (found.reason === "size")
        return { message: `Choose a size for ${current.name} in your bag, then try again.` };
      if (found.reason === "colour")
        return { message: `Choose a colour for ${current.name} in your bag, then try again.` };
      return {
        message: `${current.name} is not sold in that size and colour. Edit it in your bag and try again.`,
      };
    }
    // `current` already has the earlier lines of this order taken off, so repeats cannot oversell.
    const available = found.available;
    if (line.qty > available) {
      return {
        message:
          available <= 0
            ? `${current.name} (${line.selectedSize}) is out of stock. Remove it from your bag to continue.`
            : `Only ${available} of ${current.name} (${line.selectedSize}) are left. Lower the quantity to continue.`,
      };
    }
    working.set(line.id, decrement(current, line.selectedSize, line.selectedColor, line.qty));
    lines.push({
      productId: current.id,
      name: current.name,
      size: line.selectedSize,
      colour: line.selectedColor,
      qty: line.qty,
      unitPriceNgn: current.priceNgn,
    });
  }

  const promo = input.promoCode ? findPromo(input.promoCode, now) : null;
  if (input.promoCode && !promo)
    return { message: "That promo code is not valid any more. Remove it and try again." };

  const totals = computeTotals(
    lines.map((l) => ({ price_ngn: l.unitPriceNgn, qty: l.qty })),
    { promoPercent: promo?.percent ?? 0, stateId: input.state },
  );
  return { lines, totals, promo, working };
}

export function sequenceNumber(db: Db, now: Date): string {
  db.sequence += 1;
  return formatOrderNumber(now, db.sequence);
}

export const mockOrders: OrdersRepository = {
  async quote(input) {
    const priced = price(getDb(), input, new Date());
    return "message" in priced
      ? { ok: false, message: priced.message }
      : { ok: true, ...priced.totals };
  },

  async place(input, context): Promise<PlaceOrderResult> {
    const db = getDb();
    const now = context.now ?? new Date();

    const repeat = [...db.orders.values()].find((o) => o.idempotencyKey === input.idempotencyKey);
    if (repeat) return { ok: true, order: repeat };

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

    const priced = price(db, { ...input, state: input.delivery.state }, now);
    if ("message" in priced) return { ok: false, message: priced.message };
    if (priced.totals.total !== input.quotedTotal)
      return {
        ok: false,
        changedTotal: priced.totals.total,
        message: `The total has changed to ₦${priced.totals.total.toLocaleString("en-NG")}. Check the amount you transfer, then confirm again.`,
      };

    const order: StoredOrder = {
      orderNumber: sequenceNumber(db, now),
      userId: context.userId,
      email: input.contact.email.toLowerCase(),
      phone: input.contact.phone,
      customerName: `${input.contact.firstName} ${input.contact.lastName}`,
      address: input.delivery.address,
      city: input.delivery.city,
      state: input.delivery.state,
      landmark: input.delivery.landmark ?? "",
      lines: priced.lines,
      ...priced.totals,
      promoCode: priced.promo?.code ?? null,
      status: "pending",
      paymentStatus: "awaiting_confirmation",
      receiptPath: input.receiptPath,
      receiptReuploadUntil: null,
      idempotencyKey: input.idempotencyKey,
      notes: input.delivery.notes ?? "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    for (const [id, updated] of priced.working) {
      const index = db.products.findIndex((p) => p.id === id);
      const existing = db.products[index];
      if (existing) db.products[index] = { ...existing, ...updated };
    }
    if (priced.promo) {
      const promoId = priced.promo.id;
      const index = db.promos.findIndex((p) => p.id === promoId);
      const promo = db.promos[index];
      if (promo) db.promos[index] = { ...promo, usedCount: promo.usedCount + 1 };
    }
    db.orders.set(order.orderNumber, order);
    return { ok: true, order };
  },

  async byNumber(orderNumber) {
    return getDb().orders.get(orderNumber) ?? null;
  },

  async lookup(orderNumber, email) {
    const order = getDb().orders.get(orderNumber);
    return order && order.email === email.trim().toLowerCase() ? order : null;
  },

  async attachReceipt(orderNumber, receiptPath, now = new Date()) {
    const db = getDb();
    const order = db.orders.get(orderNumber);
    if (!order) return { ok: false, message: "We could not find that order." };
    if (order.status !== "pending" || order.paymentStatus !== "rejected")
      return { ok: false, message: "This order does not need another receipt." };
    if (order.receiptReuploadUntil && new Date(order.receiptReuploadUntil) < now)
      return {
        ok: false,
        message: "The time to send another receipt has passed and the order was cancelled.",
      };
    if (
      !receiptPath.startsWith(`${order.idempotencyKey}/`) ||
      !(await receipts.exists(receiptPath))
    )
      return { ok: false, message: "Your receipt did not finish uploading. Choose it again." };
    db.orders.set(orderNumber, {
      ...order,
      receiptPath,
      paymentStatus: "awaiting_confirmation",
      receiptReuploadUntil: null,
      updatedAt: now.toISOString(),
    });
    return { ok: true };
  },

  async validatePromo(code, now = new Date()) {
    const promo = findPromo(code, now);
    return promo
      ? { ok: true, value: { code: promo.code, percent: promo.percent } }
      : { ok: false, message: "That code is not valid, or it has expired." };
  },

  async expireUnpaid(now = new Date()) {
    const db = getDb();
    let cancelled = 0;
    for (const order of [...db.orders.values()]) {
      if (
        order.status === "pending" &&
        order.paymentStatus === "rejected" &&
        order.receiptReuploadUntil &&
        new Date(order.receiptReuploadUntil) < now &&
        applyCancellation(db, order, now)
      )
        cancelled += 1;
    }
    return cancelled;
  },
};

/** Test helpers: a sample of what the database `orders` table would be queried for. */
export function getMockOrder(orderNumber: string): StoredOrder | undefined {
  return getDb().orders.get(orderNumber);
}

export function stockOf(productId: string): number | undefined {
  return getDb().products.find((p) => p.id === productId && p.deletedAt === null)?.qty;
}
