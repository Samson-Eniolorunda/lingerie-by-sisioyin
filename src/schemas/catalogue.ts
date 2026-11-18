import { z } from "zod";
import type { CatalogueQuery, SortKey } from "@/server/queries/catalogue";

export const CATEGORIES = ["Lingerie", "Loungewear", "Underwear", "Accessories"] as const;
export const GENDERS = ["Women", "Men", "Kids", "Unisex"] as const;
export const SORTS: readonly { readonly id: SortKey; readonly label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "reviews", label: "Most reviewed" },
  { id: "price-asc", label: "Price, low to high" },
  { id: "price-desc", label: "Price, high to low" },
  { id: "name", label: "Name" },
];
export const PAGE_SIZE = 12;
export const PRICE_CEILING = 500_000;

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const price = z.coerce.number().int().min(0).max(PRICE_CEILING);

const schema = z.object({
  category: z.enum(CATEGORIES).optional().catch(undefined),
  gender: z.enum(GENDERS).optional().catch(undefined),
  min: price.optional().catch(undefined),
  max: price.optional().catch(undefined),
  delivery: z.enum(["express", "standard"]).optional().catch(undefined),
  stock: z.literal("1").optional().catch(undefined),
  is_new: z.literal("true").optional().catch(undefined),
  search: z.string().trim().max(60).optional().catch(undefined),
  sort: z
    .enum(["newest", "reviews", "price-asc", "price-desc", "name"])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(100).catch(1),
});

export interface ParsedCatalogueParams {
  readonly query: CatalogueQuery;
  readonly page: number;
}

/** Reads the shop's URL parameters, including the legacy `?q=`, and ignores anything invalid. */
export function parseCatalogueParams(params: RawParams): ParsedCatalogueParams {
  const raw = {
    category: first(params.category),
    gender: first(params.gender),
    min: first(params.min),
    max: first(params.max),
    delivery: first(params.delivery),
    stock: first(params.stock),
    is_new: first(params.is_new),
    search: first(params.search) ?? first(params.q),
    sort: first(params.sort),
    page: first(params.page),
  };
  const v = schema.parse(raw);
  const query: CatalogueQuery = {
    category: v.category,
    gender: v.gender,
    minPrice: v.min,
    maxPrice: v.max,
    delivery: v.delivery,
    inStockOnly: v.stock === "1",
    newOnly: v.is_new === "true",
    search: v.search || undefined,
    sort: v.sort,
  };
  return { query, page: v.page };
}

/** Rebuilds the URL parameters for a query, omitting defaults, so chips and links stay in step. */
export function toSearchParams(query: CatalogueQuery, page = 1): URLSearchParams {
  const sp = new URLSearchParams();
  if (query.category) sp.set("category", query.category);
  if (query.gender) sp.set("gender", query.gender);
  if (query.minPrice !== undefined) sp.set("min", String(query.minPrice));
  if (query.maxPrice !== undefined) sp.set("max", String(query.maxPrice));
  if (query.delivery) sp.set("delivery", query.delivery);
  if (query.inStockOnly) sp.set("stock", "1");
  if (query.newOnly) sp.set("is_new", "true");
  if (query.search) sp.set("search", query.search);
  if (query.sort && query.sort !== "newest") sp.set("sort", query.sort);
  if (page > 1) sp.set("page", String(page));
  return sp;
}
