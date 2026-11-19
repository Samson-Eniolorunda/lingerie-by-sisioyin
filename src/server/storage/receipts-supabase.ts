import { serviceClient } from "@/server/supabase/clients";
import { RECEIPT_BUCKET, RECEIPT_LINK_SECONDS, type ReceiptStore } from "./receipts";

/**
 * Payment receipts in the private `payment-receipts` bucket. Only the server (service role) issues
 * signed upload addresses and signed read links, so there is no public read and no client write
 * policy; a signed link expires after five minutes.
 */
export const supabaseReceiptStore: ReceiptStore = {
  async createUpload(path, type) {
    const { data, error } = await serviceClient()
      .storage.from(RECEIPT_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw new Error("Could not issue a signed upload address.");
    return { path, url: data.signedUrl, method: "PUT", headers: { "content-type": type } };
  },

  async exists(path) {
    try {
      const { data } = await serviceClient().storage.from(RECEIPT_BUCKET).exists(path);
      return data === true;
    } catch (error) {
      // A missing object is an answer, not a failure; anything else (no connection) is raised.
      const status = (error as { status?: number }).status;
      if (status === 400 || status === 404) return false;
      throw error;
    }
  },

  async link(path) {
    const { data, error } = await serviceClient()
      .storage.from(RECEIPT_BUCKET)
      .createSignedUrl(path, RECEIPT_LINK_SECONDS);
    if (error || !data) throw new Error("Could not create a receipt link.");
    return {
      url: data.signedUrl,
      kind: path.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
      mocked: false,
      expiresInSeconds: RECEIPT_LINK_SECONDS,
    };
  },
};
