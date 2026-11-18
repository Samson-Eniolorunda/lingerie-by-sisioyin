import { computeTotals } from "@/lib/pricing";
import { formatOrderNumber } from "@/lib/order-number";
import { maxQuantity } from "@/lib/stock";
import type { OrderInput } from "@/schemas/checkout";
import type { OrderStatus, PaymentStatus, PromoRecord } from "@/types/account";
import type { Product } from "@/types/domain";
import { getDb, resetDb } from "./db";

/**
 * Development order store, held in memory. It stands in for the database `place_order` function
 * (plan SC-02) so the checkout can be built and tested without touching the live project. It re-reads
 * prices and stock from the catalogue, applies the promo and delivery fee, and decrements stock,
 * exactly as the database function must.
 */

export interface StoredLine {
  readonly productId: string;
  readonly name: string;
  readonly size: string;
  readonly colour: string;
  readonly qty: number;
  readonly unitPriceNgn: number;
}

export interface StoredOrder {
  readonly orderNumber: string;
  readonly email: string;
  readonly phone: string;
  readonly customerName: string;
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly lines: readonly StoredLine[];
  readonly subtotal: number;
  readonly discount: number;
  readonly delivery: number;
  readonly total: number;
  readonly promoCode: string | null;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  readonly receiptName: string | null;
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PromoCode = PromoRecord;

export type PlaceOrderResult =
  | { readonly ok: true; readonly order: StoredOrder }
  | { readonly ok: false; readonly message: string };

function product(id: string): Product | undefined {
  return getDb().products.find((p) => p.id === id && p.deletedAt === null);
}

export function resetMockStore(): void {
  resetDb();
}

export function findPromo(code: string, now = new Date()): PromoCode | null {
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

export function placeMockOrder(
  input: OrderInput,
  now = new Date(),
  options: { readonly receiptName?: string } = {},
): PlaceOrderResult {
  const working = new Map<string, Product>();
  const lines: StoredLine[] = [];

  for (const line of input.lines) {
    const current = working.get(line.id) ?? product(line.id);
    if (!current)
      return {
        ok: false,
        message: "One of the items in your bag is no longer sold. Remove it and try again.",
      };
    const available = maxQuantity(current, {
      size: line.selectedSize,
      colour: line.selectedColor || undefined,
    });
    if (line.qty > available) {
      return {
        ok: false,
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
    return {
      ok: false,
      message: "That promo code is not valid any more. Remove it and try again.",
    };

  const totals = computeTotals(
    lines.map((l) => ({ price_ngn: l.unitPriceNgn, qty: l.qty })),
    { promoPercent: promo?.percent ?? 0, stateId: input.delivery.state },
  );

  const db = getDb();
  db.sequence += 1;
  const order: StoredOrder = {
    orderNumber: formatOrderNumber(now, db.sequence),
    email: input.contact.email.toLowerCase(),
    phone: input.contact.phone,
    customerName: `${input.contact.firstName} ${input.contact.lastName}`,
    address: input.delivery.address,
    city: input.delivery.city,
    state: input.delivery.state,
    lines,
    ...totals,
    promoCode: promo?.code ?? null,
    status: "pending",
    paymentStatus: "awaiting_confirmation",
    receiptName: options.receiptName ?? null,
    notes: input.delivery.notes ?? "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  for (const [id, updated] of working) {
    const index = db.products.findIndex((p) => p.id === id);
    const existing = db.products[index];
    if (existing) db.products[index] = { ...existing, ...updated };
  }
  if (promo) {
    const index = db.promos.findIndex((p) => p.id === promo.id);
    db.promos[index] = { ...promo, usedCount: promo.usedCount + 1 };
  }
  db.orders.set(order.orderNumber, order);
  return { ok: true, order };
}

export function getMockOrder(orderNumber: string): StoredOrder | undefined {
  return getDb().orders.get(orderNumber);
}

/** The guest lookup: the order number and the email used together, so numbers alone reveal nothing. */
export function findMockOrder(orderNumber: string, email: string): StoredOrder | null {
  const order = getDb().orders.get(orderNumber);
  return order && order.email === email.trim().toLowerCase() ? order : null;
}

export function stockOf(productId: string): number | undefined {
  return product(productId)?.qty;
}
