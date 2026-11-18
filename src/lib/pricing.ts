import type { CartLine } from "@/types/domain";
import { deliveryFeeFor } from "./delivery";

export interface Totals {
  readonly subtotal: number;
  readonly discount: number;
  readonly delivery: number;
  readonly total: number;
}

export function lineTotal(line: Pick<CartLine, "price_ngn" | "qty">): number {
  return line.price_ngn * line.qty;
}

/**
 * Subtotal, discount, delivery and total in whole naira. The discount is a percentage of the
 * subtotal only (never of delivery) and is rounded to the nearest naira. An unknown or unset state
 * contributes no delivery fee until one is chosen.
 */
export function computeTotals(
  lines: readonly Pick<CartLine, "price_ngn" | "qty">[],
  options: { readonly promoPercent?: number; readonly stateId?: string } = {},
): Totals {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const percent = Math.min(100, Math.max(0, options.promoPercent ?? 0));
  const discount = Math.round((subtotal * percent) / 100);
  const delivery = options.stateId ? (deliveryFeeFor(options.stateId) ?? 0) : 0;
  return { subtotal, discount, delivery, total: subtotal - discount + delivery };
}
