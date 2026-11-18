/**
 * Accepts `0XXXXXXXXXX` or `+234XXXXXXXXXX` (spaces and dashes allowed) and returns the international
 * form `+234XXXXXXXXXX`, or null when the number is not a Nigerian mobile or landline number.
 */
export function normaliseNigerianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  const match = /^(?:\+234|234|0)([789]\d{9})$/.exec(digits);
  return match ? `+234${match[1]}` : null;
}
