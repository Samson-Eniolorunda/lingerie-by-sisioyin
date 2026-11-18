"use client";

import Link from "next/link";
import { Search, SlidersHorizontal, ArrowDownUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SORTS } from "@/schemas/catalogue";
import type { CatalogueQuery } from "@/server/queries/catalogue";
import { FilterFields } from "./FilterFields";

function Hidden({
  query,
  omit,
}: {
  readonly query: CatalogueQuery;
  readonly omit: readonly string[];
}) {
  const pairs: [string, string | undefined][] = [
    ["search", query.search],
    ["sort", query.sort && query.sort !== "newest" ? query.sort : undefined],
    ["category", query.category],
    ["gender", query.gender],
    ["min", query.minPrice?.toString()],
    ["max", query.maxPrice?.toString()],
    ["delivery", query.delivery],
    ["stock", query.inStockOnly ? "1" : undefined],
    ["is_new", query.newOnly ? "true" : undefined],
  ];
  return (
    <>
      {pairs
        .filter(([name, value]) => value !== undefined && !omit.includes(name))
        .map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
    </>
  );
}

const barButton =
  "flex min-h-12 flex-1 items-center justify-center gap-2 border-line text-base font-medium";

export function ShopToolbar({
  query,
  activeCount,
}: {
  readonly query: CatalogueQuery;
  readonly activeCount: number;
}) {
  const [sheet, setSheet] = useState<"filter" | "sort" | null>(null);
  const sort = query.sort ?? "newest";

  return (
    <>
      <div className="sticky top-[calc(3.5rem+var(--safe-top))] z-20 -mx-4 border-b border-line bg-page px-4 sm:top-[calc(72px+var(--safe-top))] sm:mx-0 sm:px-0">
        <form role="search" action="/shop" className="relative py-2">
          <Hidden query={query} omit={["search"]} />
          <label htmlFor="shop-search" className="sr-only">
            Search the shop
          </label>
          <Search
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute top-[1.1rem] left-3 text-subtle"
          />
          <input
            id="shop-search"
            name="search"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            defaultValue={query.search ?? ""}
            placeholder="Search the shop"
            className="min-h-12 w-full rounded-sm border border-control bg-surface pr-3 pl-10 text-base"
          />
        </form>
        <div className="flex border-t border-line md:hidden">
          <button
            type="button"
            className={`${barButton} border-r`}
            onClick={() => setSheet("filter")}
          >
            <SlidersHorizontal size={18} strokeWidth={1.5} aria-hidden="true" />
            Filter{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
          <button type="button" className={barButton} onClick={() => setSheet("sort")}>
            <ArrowDownUp size={18} strokeWidth={1.5} aria-hidden="true" />
            Sort
          </button>
        </div>
      </div>

      <Sheet
        open={sheet === "filter"}
        onOpenChange={(open) => setSheet(open ? "filter" : null)}
        title="Filter"
        className="h-[100dvh] sm:h-auto"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Link
              href={query.search ? `/shop?search=${encodeURIComponent(query.search)}` : "/shop"}
              className="flex min-h-12 items-center px-2 text-base"
            >
              Clear all
            </Link>
            <Button type="submit" form="filter-form-sheet" className="flex-1 sm:flex-none">
              Show results
            </Button>
          </div>
        }
      >
        <form id="filter-form-sheet" action="/shop" method="get">
          <Hidden
            query={query}
            omit={["category", "gender", "min", "max", "delivery", "stock", "is_new"]}
          />
          <FilterFields query={query} idPrefix="sheet" />
        </form>
      </Sheet>

      <Sheet
        open={sheet === "sort"}
        onOpenChange={(open) => setSheet(open ? "sort" : null)}
        title="Sort by"
      >
        <form action="/shop" method="get" className="flex flex-col">
          <Hidden query={query} omit={["sort"]} />
          {SORTS.map((s) => (
            <label key={s.id} className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
              <input
                type="radio"
                name="sort"
                value={s.id}
                defaultChecked={sort === s.id}
                className="size-5 accent-[var(--c-primary)]"
              />
              {s.label}
            </label>
          ))}
          <div className="mt-4 flex justify-end">
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
