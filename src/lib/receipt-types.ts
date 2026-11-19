/**
 * The one list of receipt formats and the one size limit, shared by the checkout, the server action
 * that issues an upload link, the storage module and the bucket. HEIC is not accepted: staff
 * browsers cannot show it. Phones that can decode a HEIC photograph have it converted to JPEG in
 * the browser before upload; where that is not possible the customer is asked to share it as JPEG.
 */
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

/** Under Vercel's 4.5 MB function body cap and the bucket limit, with room to spare. */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
export const MAX_RECEIPT_MB = 4;

export const RECEIPT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

const EXTENSION: Record<ReceiptType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function receiptExtension(type: ReceiptType): string {
  return EXTENSION[type];
}

export function isReceiptType(type: string): type is ReceiptType {
  return (RECEIPT_TYPES as readonly string[]).includes(type);
}

export function receiptProblem(file: { size: number; type: string }): string | null {
  if (file.size === 0) return "That file is empty. Choose your receipt again.";
  if (!isReceiptType(file.type))
    return "Attach a photograph (JPG, PNG or WebP) or a PDF. If it is a HEIC photograph, share it as JPEG first.";
  if (file.size > MAX_RECEIPT_BYTES)
    return `That file is over ${MAX_RECEIPT_MB} MB. Choose a smaller photograph or PDF.`;
  return null;
}
