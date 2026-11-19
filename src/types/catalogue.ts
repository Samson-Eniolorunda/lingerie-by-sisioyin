import type { Category, Gender } from "./domain";

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
