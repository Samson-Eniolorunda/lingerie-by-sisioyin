import type { Page, Paged } from "@/types/orders";

export const EXPORT_PAGE = 200;

/** Reads every page of a list, a page at a time; for exports, which are not shown on screen. */
export async function collectAll<T>(fetchPage: (page: Page) => Promise<Paged<T>>): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += EXPORT_PAGE) {
    const { items, total } = await fetchPage({ limit: EXPORT_PAGE, offset });
    all.push(...items);
    if (items.length === 0 || all.length >= total) return all;
  }
}

/** The `limit` and `offset` for a 1-based page number. */
export function pageFor(pageNumber: number, perPage: number): Page {
  return { limit: perPage, offset: (pageNumber - 1) * perPage };
}

export function parsePageNumber(value: string | undefined): number {
  return Math.max(1, Number.parseInt(value ?? "1", 10) || 1);
}
