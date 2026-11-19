import type { Product } from "@/types/domain";

/**
 * The most a customer may add for the chosen options. The most specific figure wins: the variant
 * (size and colour), then the colour, then the size, then the product total. This is the rule the
 * live quick view applies (`shop.js` getMaxQuantity).
 */
export function maxQuantity(
  product: Pick<Product, "qty" | "sizes" | "colours" | "variantStock">,
  selection: { readonly size?: string | undefined; readonly colour?: string | undefined },
): number {
  const { size, colour } = selection;
  if (size && colour) {
    const variant = product.variantStock.find((v) => v.size === size && v.color === colour);
    if (variant) return Math.max(0, variant.qty);
  }
  if (colour) {
    const entry = product.colours.find((c) => c.name === colour);
    if (entry?.qty !== undefined) return Math.max(0, entry.qty);
  }
  if (size) {
    const entry = product.sizes.find((s) => s.name === size);
    if (entry?.qty !== undefined) return Math.max(0, entry.qty);
  }
  return Math.max(0, product.qty);
}

/** Whether a size has any stock left in at least one colour (or at all when colours are not split). */
export function sizeAvailable(
  product: Pick<Product, "qty" | "sizes" | "variantStock">,
  size: string,
): boolean {
  const variants = product.variantStock.filter((v) => v.size === size);
  if (variants.length > 0) return variants.some((v) => v.qty > 0);
  const entry = product.sizes.find((s) => s.name === size);
  return entry?.qty !== undefined ? entry.qty > 0 : product.qty > 0;
}

export type StockNote = { readonly kind: "out" | "low" | "ok"; readonly text: string };

export function stockNote(available: number, scope: string): StockNote {
  if (available <= 0) return { kind: "out", text: "Out of stock" };
  if (available <= 5) return { kind: "low", text: `Only ${available} left${scope}` };
  return { kind: "ok", text: "In stock" };
}
