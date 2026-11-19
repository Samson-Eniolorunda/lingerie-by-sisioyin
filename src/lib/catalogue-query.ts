import type { Product } from "@/types/domain";
import type { CatalogueQuery, SortKey } from "@/types/catalogue";

export function matchesSearch(product: Product, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;
  return [product.name, product.category, product.description].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

export function applyQuery(products: readonly Product[], query: CatalogueQuery): Product[] {
  const filtered = products.filter((p) => {
    if (query.category && p.category !== query.category) return false;
    if (query.gender && p.gender !== query.gender) return false;
    if (query.minPrice !== undefined && p.priceNgn < query.minPrice) return false;
    if (query.maxPrice !== undefined && p.priceNgn > query.maxPrice) return false;
    if (query.delivery && p.deliveryType !== query.delivery) return false;
    if (query.inStockOnly && p.qty <= 0) return false;
    if (query.newOnly && !p.isNew) return false;
    if (query.search && !matchesSearch(p, query.search)) return false;
    return true;
  });
  const sort = query.sort ?? "newest";
  const compare: Record<SortKey, (a: Product, b: Product) => number> = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    reviews: (a, b) => b.reviewCount - a.reviewCount,
    "price-asc": (a, b) => a.priceNgn - b.priceNgn,
    "price-desc": (a, b) => b.priceNgn - a.priceNgn,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return [...filtered].sort(compare[sort]);
}
