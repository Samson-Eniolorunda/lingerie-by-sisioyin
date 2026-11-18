import type { CartLine } from "@/types/domain";

/** Wishlist merge: the union of product ids, without duplicates, local ones first. */
export function mergeWishlist(local: readonly string[], remote: readonly string[]): string[] {
  return [...new Set([...local, ...remote])];
}

/** Bag merge: local lines win; remote lines are added only when their variant is not already local. */
export function mergeCart(local: readonly CartLine[], remote: readonly CartLine[]): CartLine[] {
  const seen = new Set(local.map((line) => line.variantId));
  return [...local, ...remote.filter((line) => !seen.has(line.variantId))];
}

export function variantIdFor(
  productId: string,
  size: string | undefined,
  colour: string | undefined,
): string {
  return `${productId}-${size || "default"}${colour ? `-${colour}` : ""}`;
}
