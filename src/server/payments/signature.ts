import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time comparison of two strings (different lengths are simply unequal). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Paystack signs the raw body with HMAC SHA-512 using the secret key; the hex digest is in `x-paystack-signature`. */
export function paystackSignatureValid(
  rawBody: string,
  signature: string | null | undefined,
  secretKey: string | undefined,
): boolean {
  if (!signature || !secretKey) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return safeEqual(expected, signature.trim().toLowerCase());
}

/** Flutterwave sends the secret hash you chose, unchanged, in the `verif-hash` header. */
export function flutterwaveHashValid(
  header: string | null | undefined,
  secretHash: string | undefined,
): boolean {
  if (!header || !secretHash) return false;
  return safeEqual(header, secretHash);
}
