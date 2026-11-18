export const ORDER_NUMBER_PATTERN = /^LBS-\d{8}-\d{4}$/;

/** `LBS-DDMMYYYY-NNNN`, the format the database sequence issues today. */
export function formatOrderNumber(date: Date, sequence: number): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `LBS-${dd}${mm}${date.getUTCFullYear()}-${String(sequence).padStart(4, "0")}`;
}

export function normaliseOrderNumber(input: string): string {
  return input.trim().toUpperCase();
}
