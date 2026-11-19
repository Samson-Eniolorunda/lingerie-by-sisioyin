import { createReceiptUpload } from "@/server/actions/orders";
import type { ReceiptUpload } from "@/server/storage/receipts";

export type UploadOutcome =
  { readonly ok: true; readonly path: string } | { readonly ok: false; readonly message: string };

/** Sends the file straight to storage on the signed address; the failure messages say what actually went wrong. */
export async function sendToStorage(upload: ReceiptUpload, file: File): Promise<UploadOutcome> {
  let response: Response;
  try {
    response = await fetch(upload.url, {
      method: upload.method,
      headers: { ...upload.headers, "content-type": file.type },
      body: file,
    });
  } catch {
    return {
      ok: false,
      message:
        "The receipt could not be sent. Your connection may have dropped. Check it and try again.",
    };
  }
  if (response.ok) return { ok: true, path: upload.path };
  if (response.status === 413)
    return { ok: false, message: "The receipt is too large to send. Choose a smaller file." };
  if (response.status >= 500)
    return {
      ok: false,
      message: "The receipt service had a problem. Please try again in a moment.",
    };
  return {
    ok: false,
    message: "The receipt was refused. Choose the file again, or try a JPG or PDF.",
  };
}

/** Asks the server for a signed address, then uploads the file to it. */
export async function uploadReceiptFor(
  scope: string,
  file: File,
  issue: (
    input: unknown,
  ) => Promise<
    ({ readonly ok: true } & ReceiptUpload) | { readonly ok: false; readonly message: string }
  > = createReceiptUpload,
  extra: Record<string, unknown> = {},
): Promise<UploadOutcome> {
  let upload;
  try {
    upload = await issue({
      ...(scope ? { idempotencyKey: scope } : {}),
      type: file.type,
      size: file.size,
      ...extra,
    });
  } catch {
    return {
      ok: false,
      message: "We could not prepare the upload. Check your connection and try again.",
    };
  }
  if (!upload.ok) return upload;
  return sendToStorage(upload, file);
}
