import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FilterFields } from "@/features/catalogue/FilterFields";
import { ProductCard } from "@/features/catalogue/ProductCard";
import { RemoveChip } from "@/features/catalogue/RemoveChip";
import { ShopToolbar } from "@/features/catalogue/ShopToolbar";
import { formatNaira } from "@/lib/money";
import { PAGE_SIZE, parseCatalogueParams, toSearchParams } from "@/schemas/catalogue";
import {
  getProductBySlug,
  getProductsByIds,
  listProducts,
  type CatalogueQuery,
} from "@/server/queries/catalogue";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse lingerie, loungewear and underwear, with delivery across seven states.",
  alternates: { canonical: "/shop" },
};

interface Chip {
  readonly label: string;
  readonly without: CatalogueQuery;
}

function chipsFor(q: CatalogueQuery): Chip[] {
  const chips: Chip[] = [];
  if (q.search) chips.push({ label: `“${q.search}”`, without: { ...q, search: undefined } });
  if (q.category) chips.push({ label: q.category, without: { ...q, category: undefined } });
  if (q.gender) chips.push({ label: q.gender, without: { ...q, gender: undefined } });
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    const from = q.minPrice !== undefined ? formatNaira(q.minPrice) : "₦0";
    const to = q.maxPrice !== undefined ? formatNaira(q.maxPrice) : "any";
    chips.push({
      label: `${from} to ${to}`,
      without: { ...q, minPrice: undefined, maxPrice: undefined },
    });
  }
  if (q.delivery)
    chips.push({
      label: `${q.delivery === "express" ? "Express" : "Standard"} delivery`,
      without: { ...q, delivery: undefined },
    });
  if (q.inStockOnly) chips.push({ label: "In stock", without: { ...q, inStockOnly: false } });
  if (q.newOnly) chips.push({ label: "New arrivals", without: { ...q, newOnly: false } });
  return chips;
}

const href = (q: CatalogueQuery, page = 1) => {
  const qs = toSearchParams(q, page).toString();
  return qs ? `/shop?${qs}` : "/shop";
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Legacy deep link: /shop?product=<id> opened a modal; products now have their own page (R-18, S-25).
  const legacy = typeof params.product === "string" ? params.product.slice(0, 80) : undefined;
  if (legacy) {
    const target = (await getProductsByIds([legacy]))[0] ?? (await getProductBySlug(legacy));
    if (target) permanentRedirect(`/products/${target.slug}`);
  }
  const { query, page } = parseCatalogueParams(params);
  const { items: shown, total } = await listProducts(query, { limit: page * PAGE_SIZE, offset: 0 });
  const chips = chipsFor(query);
  const filterCount = chips.filter((c) => !c.label.startsWith("“")).length;

  return (
    <div className="mx-auto max-w-[1360px] px-4 pt-6 sm:px-8 md:pt-10">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">Shop</h1>
      <p className="mt-1 text-base text-muted" aria-live="polite">
        {total} {total === 1 ? "piece" : "pieces"}
      </p>

      <div className="mt-4 md:grid md:grid-cols-[15rem_1fr] md:gap-10">
        <aside className="hidden md:block" aria-label="Filters">
          <form action="/shop" method="get">
            {query.search ? <input type="hidden" name="search" value={query.search} /> : null}
            {query.sort && query.sort !== "newest" ? (
              <input type="hidden" name="sort" value={query.sort} />
            ) : null}
            <FilterFields query={query} idPrefix="side" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <Link href="/shop" className="flex min-h-12 items-center text-base">
                Clear all
              </Link>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </aside>

        <div className="min-w-0">
          <ShopToolbar query={query} activeCount={filterCount} />

          {chips.length > 0 ? (
            <div
              className="-mx-4 mt-3 flex scrollbar-none gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
              aria-label="Active filters"
            >
              {chips.map((chip) => (
                <RemoveChip key={chip.label} href={href(chip.without)} label={chip.label} />
              ))}
              <Link href="/shop" className="flex min-h-11 shrink-0 items-center px-2 text-sm">
                Clear all
              </Link>
            </div>
          ) : null}

          {shown.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-2xl">No products found</p>
              <p className="mt-2 text-base text-muted">Try fewer filters or a different search.</p>
              <ButtonLink href="/shop" variant="secondary" className="mt-6">
                Clear filters
              </ButtonLink>
            </div>
          ) : (
            <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
              {shown.map((product, index) => (
                <li key={product.id}>
                  <ProductCard product={product} priority={index < 2} headingLevel="h2" />
                </li>
              ))}
            </ul>
          )}

          {total > shown.length ? (
            <div className="mt-10 flex justify-center">
              <ButtonLink
                href={href(query, page + 1)}
                variant="secondary"
                scroll={false}
                className="w-full sm:w-auto"
              >
                Show more ({total - shown.length} left)
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
