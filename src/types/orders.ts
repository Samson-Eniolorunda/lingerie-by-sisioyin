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
  readonly idempotencyKey: string;
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
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
