import { createHash } from "node:crypto";
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES } from "@/lib/receipt-types";
import { describe, expect, it, vi } from "vitest";
import {
  cloudinaryConfig,
  deliveryUrl,
  signParams,
  uploadProductImage,
  validateImage,
} from "@/server/media/cloudinary";
import {
  mockReceiptStore,
  newReceiptPath,
  saveMockReceipt,
  validateReceipt,
} from "@/server/storage/receipts";

const bytes = new Uint8Array([1, 2, 3]);

describe("Cloudinary module", () => {
  it("is in mock mode without credentials", () => {
    expect(cloudinaryConfig({})).toBeNull();
    expect(
      cloudinaryConfig({
        CLOUDINARY_CLOUD_NAME: "c",
        CLOUDINARY_API_KEY: "k",
        CLOUDINARY_API_SECRET: "s",
      }),
    ).toEqual({ cloudName: "c", apiKey: "k", apiSecret: "s" });
  });
  it("signs the sorted parameters with the secret using SHA-1", () => {
    const expected = createHash("sha1").update("folder=f&timestamp=10secret").digest("hex");
    expect(signParams({ timestamp: 10, folder: "f" }, "secret")).toBe(expected);
  });
  it("refuses wrong types and oversized files", () => {
    expect(validateImage({ type: "image/gif", size: 10 })).toMatch(/JPEG/);
    expect(validateImage({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(validateImage({ type: "image/jpeg", size: 1000 })).toBeNull();
  });
  it("returns a marked placeholder in mock mode", async () => {
    const result = await uploadProductImage(
      { name: "a.jpg", type: "image/jpeg", bytes },
      { config: null },
    );
    expect(result.ok && result.image.mocked).toBe(true);
  });
  it("posts a signed upload and returns a delivery URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ public_id: "lingerie/abc", width: 800, height: 1000 }),
    );
    const result = await uploadProductImage(
      { name: "a.jpg", type: "image/jpeg", bytes },
      {
        config: { cloudName: "shop", apiKey: "key", apiSecret: "secret" },
        fetchImpl,
        now: () => 5000,
      },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] ?? [];
    const sent = call[1]?.body as FormData;
    expect(call[0]).toBe("https://api.cloudinary.com/v1_1/shop/image/upload");
    expect(sent.get("signature")).toBe(
      signParams({ folder: "lingerie-by-sisioyin/products", timestamp: 5 }, "secret"),
    );
    expect(sent.get("api_secret")).toBeNull();
    expect(result.ok && result.image.src).toContain(
      "res.cloudinary.com/shop/image/upload/f_auto,q_auto",
    );
  });
  it("reports a failed upload without leaking details", async () => {
    const result = await uploadProductImage(
      { name: "a.jpg", type: "image/jpeg", bytes },
      {
        config: { cloudName: "shop", apiKey: "key", apiSecret: "secret" },
        fetchImpl: (async () => new Response("no", { status: 401 })) as typeof fetch,
      },
    );
    expect(result).toEqual({
      ok: false,
      message: "The photograph could not be uploaded. Please try again.",
    });
  });
  it("builds a 4:5 delivery URL", () => {
    expect(deliveryUrl("x/y", { width: 400, cloudName: "c" })).toContain("w_400,h_500/x/y");
  });
});

describe("Receipt storage module", () => {
  it("keeps receipts under the order's key with a generated name", () => {
    const path = newReceiptPath("idem-key-0000000001", "image/jpeg");
    expect(path).toMatch(/^idem-key-0000000001\/[0-9a-f-]{36}\.jpg$/);
  });
  it("one shared list: HEIC is not stored, the limit is under Vercel's 4.5 MB cap", () => {
    expect(RECEIPT_TYPES).not.toContain("image/heic");
    expect(MAX_RECEIPT_BYTES).toBeLessThan(4.5 * 1024 * 1024);
    expect(validateReceipt({ type: "image/heic", size: 100 })).toMatch(/share it as JPEG/);
    expect(validateReceipt({ type: "text/html", size: 5 })).toMatch(/photograph/);
    expect(validateReceipt({ type: "application/pdf", size: 5 * 1024 * 1024 })).toMatch(/4 MB/);
    expect(validateReceipt({ type: "application/pdf", size: 100 })).toBeNull();
    expect(validateReceipt({ type: "image/png", size: 0 })).toMatch(/empty/);
  });
  it("hands out a signed upload address and only reports a receipt that really arrived", async () => {
    const path = newReceiptPath("idem-key-0000000002", "application/pdf");
    const upload = await mockReceiptStore.createUpload(path, "application/pdf");
    expect(upload).toMatchObject({ method: "PUT", path });
    expect(upload.url).toContain("/api/receipts/mock?path=");
    expect(await mockReceiptStore.exists(path)).toBe(false);
    saveMockReceipt(path, { type: "application/pdf", size: 10 });
    expect(await mockReceiptStore.exists(path)).toBe(true);
  });
  it("only ever returns a short-lived link, marked as a placeholder in mock mode", async () => {
    const link = await mockReceiptStore.link("LBS-1/x.pdf");
    expect(link).toMatchObject({ kind: "pdf", mocked: true, expiresInSeconds: 300 });
  });
});
