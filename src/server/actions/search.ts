"use server";

import { z } from "zod";
import { listProducts } from "@/server/queries/catalogue";

const termSchema = z.string().trim().min(2).max(60);

export interface SearchHit {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  readonly priceNgn: number;
  readonly image: string | undefined;
  readonly imageAlt: string;
}

export interface SearchResult {
  readonly hits: readonly SearchHit[];
  /** Latest products offered when nothing matches (G-07). */
  readonly fallback: readonly SearchHit[];
  readonly total: number;
}

function toHit(p: Awaited<ReturnType<typeof listProducts>>[number]): SearchHit {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    priceNgn: p.priceNgn,
    image: p.images[0]?.src,
    imageAlt: p.images[0]?.alt ?? "",
  };
}

/** The term is matched in application code, never concatenated into a query (SEC-18). */
export async function searchProducts(input: string): Promise<SearchResult> {
  const parsed = termSchema.safeParse(input);
  if (!parsed.success) return { hits: [], fallback: [], total: 0 };
  const matches = await listProducts({ search: parsed.data });
  if (matches.length > 0)
    return { hits: matches.slice(0, 8).map(toHit), fallback: [], total: matches.length };
  const latest = await listProducts({ sort: "newest" });
  return { hits: [], fallback: latest.slice(0, 6).map(toHit), total: 0 };
}
