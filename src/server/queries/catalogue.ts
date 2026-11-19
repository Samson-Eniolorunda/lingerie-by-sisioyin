import { data } from "@/server/data";
import type { Page, Paged } from "@/types/orders";
import type { CatalogueQuery } from "@/types/catalogue";
import type { Product } from "@/types/domain";

export type { CatalogueQuery, SortKey } from "@/types/catalogue";
export { applyQuery, matchesSearch } from "@/lib/catalogue-query";

/** The read path for products. Everything goes through the catalogue contract; hidden and trashed products never reach the shop. */
export async function listProducts(
  query: CatalogueQuery = {},
  page: Page = { limit: 1000, offset: 0 },
): Promise<Paged<Product>> {
  return data.catalogue.list(query, page);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return data.catalogue.bySlug(slug);
}

export async function getProductsByIds(ids: readonly string[]): Promise<Product[]> {
  return [...(await data.catalogue.byIds(ids))];
}

export async function newArrivals(limit = 8): Promise<Product[]> {
  return [...(await data.catalogue.newArrivals(limit))];
}
