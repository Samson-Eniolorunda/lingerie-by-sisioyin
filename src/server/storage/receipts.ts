import { randomUUID } from "node:crypto";
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_TYPES,
  receiptExtension,
  receiptProblem,
  type ReceiptType,
} from "@/lib/receipt-types";

/**
 * The one module for private payment receipts. They go to a private Supabase Storage bucket
 * (`payment-receipts`, no public read). The browser uploads straight to storage through a signed
 * upload address issued here, so the file never passes through a server action (Next's 1 MB default
 * and Vercel's 4.5 MB cap do not apply). Staff see receipts only through short-lived signed links.
 * Until the new project exists this runs in mock mode: files are held in memory by a route handler.
 */

export const RECEIPT_BUCKET = "payment-receipts";
export const RECEIPT_LINK_SECONDS = 300;
export { MAX_RECEIPT_BYTES, RECEIPT_TYPES };

export interface ReceiptLink {
  readonly url: string;
  readonly kind: "image" | "pdf";
  /** True when the link is a placeholder because no storage is connected. */
  readonly mocked: boolean;
  readonly expiresInSeconds: number;
}

export interface ReceiptUpload {
  /** The object path to store on the order. */
  readonly path: string;
  /** Where the browser sends the file, with `method` and `headers`. */
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Readonly<Record<string, string>>;
}

export interface ReceiptStore {
  /** A signed address the browser can upload one file of this type to. */
  createUpload(path: string, type: ReceiptType): Promise<ReceiptUpload>;
  /** Whether the object was actually uploaded; checked before an order or a new receipt is accepted. */
  exists(path: string): Promise<boolean>;
  /** A signed link that expires; never a public URL. */
  link(path: string): Promise<ReceiptLink>;
}

/** `<scope>/<random>.<ext>`: the scope is the order's idempotency key, so a path can be matched to its order. */
export function newReceiptPath(scope: string, type: ReceiptType): string {
  return `${scope}/${randomUUID()}.${receiptExtension(type)}`;
}

export function validateReceipt(file: { type: string; size: number }): string | null {
  return receiptProblem(file);
}

interface MockObject {
  readonly type: string;
  readonly size: number;
}

declare global {
  var __lbsMockReceipts: Map<string, MockObject> | undefined;
}

function objects(): Map<string, MockObject> {
  globalThis.__lbsMockReceipts ??= new Map();
  return globalThis.__lbsMockReceipts;
}

/** Used by the mock upload route only. */
export function saveMockReceipt(path: string, object: MockObject): void {
  const map = objects();
  if (map.size >= 500) map.delete(map.keys().next().value as string);
  map.set(path, object);
}

export const mockReceiptStore: ReceiptStore = {
  async createUpload(path, type) {
    return {
      path,
      url: `/api/receipts/mock?path=${encodeURIComponent(path)}`,
      method: "PUT",
      headers: { "content-type": type },
    };
  },
  async exists(path) {
    return objects().has(path);
  },
  async link(path) {
    return {
      url: "/placeholders/receipt.svg",
      kind: path.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
      mocked: true,
      expiresInSeconds: RECEIPT_LINK_SECONDS,
    };
  },
};

/** The one place that chooses the implementation; the Supabase store replaces the mock here. */
export const receipts: ReceiptStore = mockReceiptStore;
