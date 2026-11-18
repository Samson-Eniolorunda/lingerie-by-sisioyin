"use client";

import { useSyncExternalStore } from "react";
import { createLocalStore } from "@/lib/local-store";
import { wishlistSchema } from "@/schemas/cart";

export const WISHLIST_KEY = "LBS_WISHLIST";

const EMPTY: string[] = [];

const store = createLocalStore<string[]>(WISHLIST_KEY, EMPTY, (raw) => {
  const parsed = wishlistSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
});

export function useWishlist(): readonly string[] {
  return useSyncExternalStore(store.subscribe, store.get, store.serverValue);
}

export function toggleWishlist(productId: string): boolean {
  const current = store.get();
  const has = current.includes(productId);
  store.set(has ? current.filter((id) => id !== productId) : [...current, productId]);
  return !has;
}

export function removeFromWishlist(productId: string): void {
  store.set(store.get().filter((id) => id !== productId));
}

export function clearWishlist(): void {
  store.set([]);
}
