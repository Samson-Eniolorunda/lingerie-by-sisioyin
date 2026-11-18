import { FIXTURE_PRODUCTS } from "@/data/fixtures";
import type { Category, Gender, Product } from "@/types/domain";

export type SortKey = "newest" | "reviews" | "price-asc" | "price-desc" | "name";

export interface CatalogueQuery {
  readonly category?: Category | undefined;
  readonly gender?: Gender | undefined;
  readonly minPrice?: number | undefined;
  readonly maxPrice?: number | undefined;
  readonly delivery?: "express" | "standard" | undefined;
  readonly inStockOnly?: boolean | undefined;
  readonly newOnly?: boolean | undefined;
  readonly search?: string | undefined;
  readonly sort?: SortKey | undefined;
}

/** The single read path for products. Today it serves the development fixtures. */
async function allProducts(): Promise<readonly Product[]> {
  return FIXTURE_PRODUCTS;
}

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

export async function listProducts(query: CatalogueQuery = {}): Promise<Product[]> {
  return applyQuery(await allProducts(), query);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return (await allProducts()).find((p) => p.slug === slug) ?? null;
}

export async function getProductsByIds(ids: readonly string[]): Promise<Product[]> {
  const all = await allProducts();
  return ids.flatMap((id) => all.find((p) => p.id === id) ?? []);
}

export async function newArrivals(limit = 8): Promise<Product[]> {
  const all = await allProducts();
  const fresh = all.filter((p) => p.isNew);
  const pool =
    fresh.length >= 4 ? fresh : [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return pool.slice(0, limit);
}
