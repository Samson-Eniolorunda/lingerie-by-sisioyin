import { applyQuery } from "@/lib/catalogue-query";
import type { CatalogueRepository } from "@/server/data/contracts";
import type { Product } from "@/types/domain";
import { anonClient } from "./clients";
import { productFromRow } from "./mappers";
import { isUuid, must } from "./util";

/**
 * Reads the live catalogue with the public key: row level security already hides inactive and
 * trashed products, and the query adds the same filter so the intent is visible. The shop sells a
 * few hundred products at most, so the filters and the sort run over the whole live list, exactly
 * as the development store does; if the catalogue ever outgrows that, move them into the query.
 */
const LIVE_LIMIT = 2000;

async function live(): Promise<Product[]> {
  const rows = must(
    await anonClient()
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(LIVE_LIMIT),
  );
  return rows.map(productFromRow);
}

export const supabaseCatalogue: CatalogueRepository = {
  async list(query, page) {
    const all = applyQuery(await live(), query);
    return { items: all.slice(page.offset, page.offset + page.limit), total: all.length };
  },
  async bySlug(slug) {
    const rows = must(
      await anonClient()
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .eq("is_deleted", false)
        .limit(1),
    );
    const row = rows[0];
    return row ? productFromRow(row) : null;
  },
  async byIds(ids) {
    const wanted = ids.filter(isUuid);
    if (wanted.length === 0) return [];
    const rows = must(
      await anonClient()
        .from("products")
        .select("*")
        .in("id", wanted)
        .eq("is_active", true)
        .eq("is_deleted", false),
    );
    const byId = new Map(rows.map((r) => [String(r.id), productFromRow(r)]));
    return wanted.flatMap((id) => byId.get(id) ?? []);
  },
  async newArrivals(limit) {
    const all = await live();
    const fresh = all.filter((p) => p.isNew);
    const pool = fresh.length >= 4 ? fresh : all;
    return pool.slice(0, limit);
  },
};
