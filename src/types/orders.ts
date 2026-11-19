import type { OrderStatus, PaymentStatus } from "./account";

/** Shapes for orders, shared by the pages, the actions and the data-access contracts. */

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
  /** The account that placed it, or null for a guest order not yet attached to a verified account. */
  readonly userId: string | null;
  readonly email: string;
  readonly phone: string;
  readonly customerName: string;
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly landmark: string;
  readonly lines: readonly StoredLine[];
  readonly subtotal: number;
  readonly discount: number;
  readonly delivery: number;
  readonly total: number;
  readonly promoCode: string | null;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  /** The storage path returned by the signed upload, never a raw file name. */
  readonly receiptPath: string | null;
  /** When a rejected receipt may still be replaced; after this the order is cancelled. */
  readonly receiptReuploadUntil: string | null;
  /** What is owed back to the customer (a refund owed, or after an accepted refund check). */
  readonly refundAmount?: number | null;
  readonly idempotencyKey: string;
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * What the public tracking page may see: no phone number, street address, name, account, notes,
 * receipt path or idempotency key, because anyone who guesses an order number and an e-mail
 * address would see them.
 */
export type TrackedOrder = Pick<
  StoredOrder,
  | "orderNumber"
  | "status"
  | "paymentStatus"
  | "lines"
  | "subtotal"
  | "discount"
  | "delivery"
  | "total"
  | "promoCode"
  | "city"
  | "state"
  | "receiptReuploadUntil"
  | "createdAt"
>;

export function trackedOrder(order: StoredOrder): TrackedOrder {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    lines: order.lines,
    subtotal: order.subtotal,
    discount: order.discount,
    delivery: order.delivery,
    total: order.total,
    promoCode: order.promoCode,
    city: order.city,
    state: order.state,
    receiptReuploadUntil: order.receiptReuploadUntil,
    createdAt: order.createdAt,
  };
}

/** A receipt in the private bucket that no order uses: a customer who paid but whose order failed, or an abandoned upload. */
export interface OrphanReceipt {
  readonly path: string;
  readonly uploadedAt: string;
  /** Set when the checkout failed after the upload (the customer may have paid and must be contacted). */
  readonly failureId: string | null;
  readonly customerName: string;
  readonly email: string;
  readonly phone: string;
  readonly quotedTotal: number | null;
  readonly reason: string;
  readonly resolved: boolean;
}

export interface Quote {
  readonly subtotal: number;
  readonly discount: number;
  readonly delivery: number;
  readonly total: number;
}

export type QuoteResult =
  ({ readonly ok: true } & Quote) | { readonly ok: false; readonly message: string };

export type PlaceOrderResult =
  | { readonly ok: true; readonly order: StoredOrder }
  | {
      readonly ok: false;
      readonly message: string;
      /** Set when the amount the customer was shown no longer matches; carries the new total. */
      readonly changedTotal?: number;
    };

export interface Page {
  readonly limit: number;
  readonly offset: number;
}

export interface Paged<T> {
  readonly items: readonly T[];
  readonly total: number;
}

export const DEFAULT_PAGE_SIZE = 20;
