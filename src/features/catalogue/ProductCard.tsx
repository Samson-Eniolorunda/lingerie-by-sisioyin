import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/ui/ProductImage";
import { formatNaira } from "@/lib/money";
import type { Product } from "@/types/domain";
import { WishlistHeart } from "./WishlistHeart";

export const TILE_SIZES = "(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw";

/** One tap on the tile opens the product; the heart is the only control over the image. */
export function ProductCard({
  product,
  priority,
}: {
  readonly product: Product;
  readonly priority?: boolean;
}) {
  const soldOut = product.qty <= 0;
  return (
    <article className="relative">
      <Link
        href={`/products/${product.slug}`}
        className="block text-ink no-underline hover:text-ink"
      >
        <ProductImage image={product.images[0]} sizes={TILE_SIZES} priority={priority ?? false} />
        <div className="mt-3 flex flex-col gap-1">
          {product.isNew ? <Badge tone="new">New</Badge> : null}
          <h3 className="line-clamp-2 font-sans text-base leading-snug font-normal">
            {product.name}
          </h3>
          <p className="tabular text-base font-medium">{formatNaira(product.priceNgn)}</p>
          {soldOut ? <p className="text-sm text-subtle">Out of stock</p> : null}
        </div>
      </Link>
      <WishlistHeart
        productId={product.id}
        name={product.name}
        className="absolute top-0 right-0"
      />
    </article>
  );
}
