import { createHash } from "node:crypto";

/**
 * The one module for product photographs (Cloudinary, free plan). Uploads happen on the server so the
 * API secret never reaches a browser. With no credentials configured the module runs in mock mode and
 * hands back a clearly marked placeholder, so the admin can be built and tested without the service.
 *
 * Environment names: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_FOLDER = "lingerie-by-sisioyin/products";

export interface CloudinaryConfig {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

export interface UploadedImage {
  readonly src: string;
  readonly publicId: string;
  readonly width: number;
  readonly height: number;
  /** True when the image is a placeholder because no credentials are set. */
  readonly mocked: boolean;
}

export type UploadResult =
  | { readonly ok: true; readonly image: UploadedImage }
  | { readonly ok: false; readonly message: string };

type Env = Readonly<Record<string, string | undefined>>;

export function cloudinaryConfig(env: Env = process.env): CloudinaryConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/** Cloudinary's signature: the sorted `key=value` pairs joined with `&`, the secret appended, SHA-1. */
export function signParams(
  params: Readonly<Record<string, string | number>>,
  secret: string,
): string {
  const base = Object.keys(params)
    .filter((key) => params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(base + secret)
    .digest("hex");
}

export function validateImage(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Choose a JPEG, PNG or WebP photograph.";
  if (file.size > MAX_IMAGE_BYTES) return "Each photograph must be 5 MB or smaller.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** Delivery URL with automatic format and quality and a 4:5 crop, so every card has one shape. */
export function deliveryUrl(
  publicId: string,
  options: { readonly width?: number; readonly cloudName?: string } = {},
): string {
  const cloud = options.cloudName ?? process.env.CLOUDINARY_CLOUD_NAME ?? "demo";
  const width = options.width ?? 800;
  const height = Math.round(width * 1.25);
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,c_fill,g_auto,w_${width},h_${height}/${publicId}`;
}

let placeholderIndex = 0;

export async function uploadProductImage(
  file: { readonly name: string; readonly type: string; readonly bytes: Uint8Array },
  options: {
    readonly config?: CloudinaryConfig | null;
    readonly fetchImpl?: typeof fetch;
    readonly now?: () => number;
  } = {},
): Promise<UploadResult> {
  const problem = validateImage({ type: file.type, size: file.bytes.byteLength });
  if (problem) return { ok: false, message: problem };

  const config = options.config === undefined ? cloudinaryConfig() : options.config;
  if (!config) {
    placeholderIndex = (placeholderIndex % 3) + 1;
    return {
      ok: true,
      image: {
        src: `/placeholders/product-${placeholderIndex}.svg`,
        publicId: `placeholder-${placeholderIndex}`,
        width: 800,
        height: 1000,
        mocked: true,
      },
    };
  }

  const timestamp = Math.floor((options.now?.() ?? Date.now()) / 1000);
  const signed = { folder: IMAGE_FOLDER, timestamp };
  const form = new FormData();
  form.set("file", new Blob([file.bytes as BlobPart], { type: file.type }), file.name);
  form.set("api_key", config.apiKey);
  form.set("timestamp", String(timestamp));
  form.set("folder", IMAGE_FOLDER);
  form.set("signature", signParams(signed, config.apiSecret));

  const send = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await send(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
  } catch {
    return { ok: false, message: "The photograph could not be uploaded. Please try again." };
  }
  if (!response.ok)
    return { ok: false, message: "The photograph could not be uploaded. Please try again." };
  const body = (await response.json()) as {
    public_id?: string;
    width?: number;
    height?: number;
  };
  if (!body.public_id)
    return { ok: false, message: "The photograph could not be uploaded. Please try again." };
  return {
    ok: true,
    image: {
      src: deliveryUrl(body.public_id, { cloudName: config.cloudName }),
      publicId: body.public_id,
      width: body.width ?? 800,
      height: body.height ?? 1000,
      mocked: false,
    },
  };
}
