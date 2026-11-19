import type { ColourEntry, SizeEntry, VariantStock } from "@/types/domain";

export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "One Size"] as const;

export interface VariantRow {
  readonly size: string;
  readonly color: string;
  readonly qty: number;
}

export interface DerivedStock {
  readonly sizes: readonly SizeEntry[];
  readonly colours: readonly ColourEntry[];
  readonly variantStock: readonly VariantStock[];
  readonly qty: number;
}

function sizeRank(size: string): number {
  const index = SIZE_ORDER.indexOf(size as (typeof SIZE_ORDER)[number]);
  return index === -1 ? SIZE_ORDER.length : index;
}

/** Sizes in the fixed order (XS to XXXL, One Size last); bra sizes and other names follow, sorted. */
export function compareSizes(a: string, b: string): number {
  const diff = sizeRank(a) - sizeRank(b);
  return diff !== 0 ? diff : a.localeCompare(b, "en", { numeric: true });
}

/**
 * Adds a variant, or replaces the quantity of an existing size and colour pair (MI-13). Negative
 * quantities are refused by returning the rows unchanged.
 */
export function upsertVariant(rows: readonly VariantRow[], next: VariantRow): VariantRow[] {
  if (!Number.isInteger(next.qty) || next.qty < 0 || next.size.trim() === "") return [...rows];
  const size = next.size.trim();
  const color = next.color.trim();
  const exists = rows.some((r) => r.size === size && r.color === color);
  return exists
    ? rows.map((r) => (r.size === size && r.color === color ? { size, color, qty: next.qty } : r))
    : [...rows, { size, color, qty: next.qty }];
}

export function removeVariant(
  rows: readonly VariantRow[],
  size: string,
  color: string,
): VariantRow[] {
  return rows.filter((r) => !(r.size === size && r.color === color));
}

/** Rows grouped by size in the fixed order, each group sorted by colour. */
export function groupBySize(
  rows: readonly VariantRow[],
): { readonly size: string; readonly rows: readonly VariantRow[]; readonly units: number }[] {
  const sizes = [...new Set(rows.map((r) => r.size))].sort(compareSizes);
  return sizes.map((size) => {
    const group = rows
      .filter((r) => r.size === size)
      .sort((a, b) => a.color.localeCompare(b.color));
    return { size, rows: group, units: group.reduce((n, r) => n + r.qty, 0) };
  });
}

export function totalUnits(rows: readonly VariantRow[]): number {
  return rows.reduce((n, r) => n + r.qty, 0);
}

/**
 * Derives the product's sizes, colours and stock total from its variants (MI-15). An assorted pack
 * keeps no colours and no variant stock: its quantity sits on the sizes (MI-16).
 */
export function deriveStock(
  rows: readonly VariantRow[],
  allowColourSelection: boolean,
): DerivedStock {
  const clean = rows.filter((r) => r.qty >= 0);
  const sizeNames = [...new Set(clean.map((r) => r.size))].sort(compareSizes);
  if (!allowColourSelection) {
    const sizes = sizeNames.map((name) => ({
      name,
      qty: clean.filter((r) => r.size === name).reduce((n, r) => n + r.qty, 0),
    }));
    return { sizes, colours: [], variantStock: [], qty: totalUnits(clean) };
  }
  const colourNames = [...new Set(clean.map((r) => r.color).filter((c) => c !== ""))].sort();
  return {
    sizes: sizeNames.map((name) => ({ name })),
    colours: colourNames.map((name) => ({ name })),
    variantStock: [...clean].sort((a, b) => compareSizes(a.size, b.size)),
    qty: totalUnits(clean),
  };
}

/** The editable rows for an existing product, whichever way its stock is stored. */
export function rowsFromProduct(product: {
  readonly sizes: readonly SizeEntry[];
  readonly variantStock: readonly VariantStock[];
}): VariantRow[] {
  if (product.variantStock.length > 0) return product.variantStock.map((v) => ({ ...v }));
  return product.sizes.map((s) => ({ size: s.name, color: "", qty: s.qty ?? 0 }));
}

export type VariantLookup =
  | { readonly ok: true; readonly available: number; readonly kind: "variant" | "size" | "product" }
  | { readonly ok: false; readonly reason: "size" | "colour" | "variant" };

/**
 * The exact variant an order line names, and how many of it are in stock. A product with colours
 * needs both a size and a colour that exist together; a product sold by size needs a listed size; a
 * product without sizes is sold as it is. Nothing falls back to the product total, so a line can
 * never be satisfied by stock that belongs to another variant.
 */
export function lookupVariant(
  product: {
    readonly qty: number;
    readonly sizes: readonly SizeEntry[];
    readonly colours: readonly ColourEntry[];
    readonly variantStock: readonly VariantStock[];
    readonly allowColourSelection?: boolean;
  },
  size: string,
  colour: string,
): VariantLookup {
  if (product.variantStock.length > 0) {
    if (size === "") return { ok: false, reason: "size" };
    if (colour === "") return { ok: false, reason: "colour" };
    const variant = product.variantStock.find((v) => v.size === size && v.color === colour);
    return variant
      ? { ok: true, available: Math.max(0, variant.qty), kind: "variant" }
      : { ok: false, reason: "variant" };
  }
  if (product.allowColourSelection !== false && product.colours.length > 0 && colour === "")
    return { ok: false, reason: "colour" };
  if (product.sizes.length > 0) {
    if (size === "") return { ok: false, reason: "size" };
    const entry = product.sizes.find((s) => s.name === size);
    if (!entry) return { ok: false, reason: "variant" };
    return { ok: true, available: Math.max(0, entry.qty ?? product.qty), kind: "size" };
  }
  return { ok: true, available: Math.max(0, product.qty), kind: "product" };
}
