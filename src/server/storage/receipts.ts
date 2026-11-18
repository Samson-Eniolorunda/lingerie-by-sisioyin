/**
 * The one module for private payment receipts. They go to a private Supabase Storage bucket
 * (`payment-receipts`, no public read) and are shown to staff only through short-lived signed links.
 * Until the new project exists this runs in mock mode: nothing is stored and the link is a marked
 * placeholder, so the receipt screen can be built and tested.
 */

export const RECEIPT_BUCKET = "payment-receipts";
export const RECEIPT_LINK_SECONDS = 300;
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export interface ReceiptLink {
  readonly url: string;
  readonly kind: "image" | "pdf";
  /** True when the link is a placeholder because no storage is connected. */
  readonly mocked: boolean;
  readonly expiresInSeconds: number;
}

export interface ReceiptStore {
  /** Stores a receipt under `<order number>/<file name>` and returns its object path. */
  save(
    orderNumber: string,
    file: { name: string; type: string; bytes: Uint8Array },
  ): Promise<string>;
  /** A signed link that expires; never a public URL. */
  link(path: string): Promise<ReceiptLink>;
}

export function receiptPath(orderNumber: string, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || "receipt";
  return `${orderNumber}/${safe}`;
}

export function validateReceipt(file: { type: string; size: number }): string | null {
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type))
    return "Attach a photograph or a PDF of your receipt.";
  if (file.size > MAX_RECEIPT_BYTES) return "The receipt must be 5 MB or smaller.";
  return null;
}

export const mockReceiptStore: ReceiptStore = {
  async save(orderNumber, file) {
    return receiptPath(orderNumber, file.name);
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
