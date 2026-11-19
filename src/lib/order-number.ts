import { lagosParts } from "./dates";

/** Four digits or more: the sequence keeps counting past 9999 without breaking the format. */
export const ORDER_NUMBER_PATTERN = /^LBS-\d{8}-\d{4,}$/;

/** `LBS-DDMMYYYY-NNNN` with the Africa/Lagos calendar date, the format the database sequence issues. */
export function formatOrderNumber(date: Date, sequence: number): string {
  const { day, month, year } = lagosParts(date);
  return `LBS-${day}${month}${year}-${String(sequence).padStart(4, "0")}`;
}

export function normaliseOrderNumber(input: string): string {
  return input.trim().toUpperCase();
}
