"use server";

import { z } from "zod";
import { getProductsByIds } from "@/server/queries/catalogue";
import type { Product } from "@/types/domain";

/** One live product for the quick view and the bag-line editor. Hidden and trashed products are not returned. */
export async function quickViewProduct(id: string): Promise<Product | null> {
  const parsed = z.string().min(1).max(80).safeParse(id);
  if (!parsed.success) return null;
  return (await getProductsByIds([parsed.data]))[0] ?? null;
}
