"use client";

import { useSyncExternalStore } from "react";
import { createLocalStore } from "@/lib/local-store";
import { cartSchema } from "@/schemas/cart";
import type { CartLine } from "@/types/domain";

/** Same key and line shape as the live site, so a bag built before launch is still there after it. */
export const CART_KEY = "LBS_CART_V1";

const EMPTY: CartLine[] = [];

const store = createLocalStore<CartLine[]>(CART_KEY, EMPTY, (raw) => {
  const parsed = cartSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
});

export function useCart(): readonly CartLine[] {
  return useSyncExternalStore(store.subscribe, store.get, store.serverValue);
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((n, line) => n + line.qty, 0);
}

/** Adds a line, or raises the quantity of the same variant, never above `max`. */
export function addToCart(line: CartLine, max: number): void {
  const current = store.get();
  const existing = current.find((l) => l.variantId === line.variantId);
  const next = existing
    ? current.map((l) =>
        l.variantId === line.variantId ? { ...l, qty: Math.min(max, l.qty + line.qty) } : l,
      )
    : [...current, { ...line, qty: Math.min(max, line.qty) }];
  store.set(next);
}

export function setLineQuantity(variantId: string, qty: number): void {
  store.set(
    store
      .get()
      .map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(1, Math.min(99, qty)) } : l)),
  );
}

export function removeLine(variantId: string): CartLine | undefined {
  const current = store.get();
  const removed = current.find((l) => l.variantId === variantId);
  store.set(current.filter((l) => l.variantId !== variantId));
  return removed;
}

export function restoreLine(line: CartLine): void {
  const current = store.get();
  if (!current.some((l) => l.variantId === line.variantId)) store.set([...current, line]);
}

export function replaceLine(variantId: string, line: CartLine): void {
  store.set(store.get().map((l) => (l.variantId === variantId ? line : l)));
}

export function clearCart(): void {
  store.set([]);
}
