import { applyQuery } from "@/lib/catalogue-query";
import type { CatalogueRepository } from "@/server/data/contracts";
import type { Product } from "@/types/domain";
import { getDb } from "./db";

/** Hidden and trashed products never reach the shop. */
function live(): Product[] {
  return getDb().products.filter((p) => p.active && p.deletedAt === null);
}

export const mockCatalogue: CatalogueRepository = {
  async list(query, page) {
    const all = applyQuery(live(), query);
    return { items: all.slice(page.offset, page.offset + page.limit), total: all.length };
  },
  async bySlug(slug) {
    return live().find((p) => p.slug === slug) ?? null;
  },
  async byIds(ids) {
    const all = live();
    return ids.flatMap((id) => all.find((p) => p.id === id) ?? []);
  },
  async newArrivals(limit) {
    const all = live();
    const fresh = all.filter((p) => p.isNew);
    const pool =
      fresh.length >= 4 ? fresh : [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return pool.slice(0, limit);
  },
};
