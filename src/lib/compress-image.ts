/** Fits an image inside 800 × 1000 px and re-encodes it as JPEG at 0.82 (MI-17). Small files and non-images are left alone. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 50 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 800 / bitmap.width, 1000 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const RECEIPT_EDGE = 1600;

async function toJpeg(bitmap: ImageBitmap, edge: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, edge / bitmap.width, edge / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export type PreparedReceipt =
  { readonly ok: true; readonly file: File } | { readonly ok: false; readonly message: string };

/**
 * Gets a receipt ready to upload: a photograph is scaled to fit 1600 px and re-encoded as JPEG,
 * lowering the quality in steps until it is under the limit, so a 12-megapixel phone photograph
 * becomes a few hundred kilobytes. HEIC is converted here where the browser can decode it. A PDF is
 * passed through and refused if it is over the limit. The result has a clear message when it cannot
 * be made small enough or read at all.
 */
export async function prepareReceipt(file: File, maxBytes: number): Promise<PreparedReceipt> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return file.size <= maxBytes
      ? { ok: true, file }
      : { ok: false, message: "That PDF is too large. Choose a smaller one or send a photograph." };
  }
  const readable =
    file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!readable) return { ok: false, message: "Attach a photograph (JPG, PNG or WebP) or a PDF." };
  try {
    const bitmap = await createImageBitmap(file);
    for (const [edge, quality] of [
      [RECEIPT_EDGE, 0.82],
      [RECEIPT_EDGE, 0.65],
      [1200, 0.6],
      [900, 0.55],
    ] as const) {
      const blob = await toJpeg(bitmap, edge, quality);
      if (blob && blob.size <= maxBytes)
        return {
          ok: true,
          file: new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
            type: "image/jpeg",
          }),
        };
    }
    return {
      ok: false,
      message: "That photograph is too large to send. Take a screenshot instead.",
    };
  } catch {
    return {
      ok: false,
      message: /heic|heif/i.test(file.type + file.name)
        ? "This phone photograph format cannot be read here. Share it as JPEG, or take a screenshot of your receipt."
        : "That file could not be read as a photograph. Choose another, or a PDF.",
    };
  }
}
