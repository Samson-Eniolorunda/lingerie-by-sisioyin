"use server";

import { z } from "zod";
import { getProductsByIds } from "@/server/queries/catalogue";
import type { Product } from "@/types/domain";

const idsSchema = z.array(z.string().min(1).max(60)).max(200);

export async function wishlistProducts(ids: readonly string[]): Promise<Product[]> {
  const parsed = idsSchema.safeParse(ids);
  return parsed.success ? getProductsByIds(parsed.data) : [];
}
