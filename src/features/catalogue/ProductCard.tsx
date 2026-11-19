import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/ui/ProductImage";
import { formatNaira } from "@/lib/money";
import type { Product } from "@/types/domain";
import { QuickViewButton } from "@/features/product/QuickView";
import { WishlistHeart } from "./WishlistHeart";

export const TILE_SIZES = "(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw";

/** One tap on the tile opens the product; the heart is the only control over the image. */
export function ProductCard({
  product,
  priority,
  headingLevel = "h3",
}: {
  readonly product: Product;
  readonly priority?: boolean;
  /** Level of the product name: h2 where the page has no section heading above the grid, h3 under one. */
  readonly headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const soldOut = product.qty <= 0;
  return (
    <article className="relative flex h-full flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="flex flex-1 flex-col text-ink no-underline hover:text-ink"
      >
        {/* The chip overlays the image so it never changes the height of the text below. */}
        <div className="relative">
          <ProductImage image={product.images[0]} sizes={TILE_SIZES} priority={priority ?? false} />
          {product.isNew ? (
            <span className="absolute top-2 left-2">
              <Badge tone="new">New</Badge>
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-1 flex-col gap-1">
          {/* Two lines are always reserved, so prices line up across a row. */}
          <Heading className="line-clamp-2 min-h-[2.75rem] font-sans text-base leading-snug font-normal">
            {product.name}
          </Heading>
          <p className="tabular mt-auto text-base font-medium">
            {formatNaira(product.priceNgn)}
            {soldOut ? (
              <span className="ml-2 text-sm font-normal text-subtle">Out of stock</span>
            ) : null}
          </p>
        </div>
      </Link>
      <WishlistHeart
        productId={product.id}
        name={product.name}
        className="absolute top-0 right-0"
      />
      {soldOut ? (
        <div aria-hidden="true" className="h-11" />
      ) : (
        <QuickViewButton productId={product.id} name={product.name} className="-ml-2" />
      )}
    </article>
  );
}
