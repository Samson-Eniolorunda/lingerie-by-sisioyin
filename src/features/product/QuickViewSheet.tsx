"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/money";
import { quickViewProduct } from "@/server/actions/quick-view";
import type { CartLine, Product } from "@/types/domain";
import { PurchasePanel } from "./PurchasePanel";

/**
 * The product in a sheet: thumbnails, price, description and the same size, colour and quantity
 * controls as the product page. With `edit` it reopens a bag line pre-filled and replaces it (S-18).
 */
export function QuickViewSheet({
  productId,
  open,
  onOpenChange,
  edit,
}: {
  readonly productId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly edit?: CartLine;
}) {
  const [state, setState] = useState<{ id: string; product: Product | null } | null>(null);
  const [shot, setShot] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void quickViewProduct(productId).then((product) => {
      if (!cancelled) setState({ id: productId, product });
    });
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const product = state?.id === productId ? state.product : undefined;
  const image = product?.images[shot] ?? product?.images[0];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? "Change this item" : (product?.name ?? "Quick view")}
      {...(edit ? { description: "Choose a different size, colour or quantity." } : {})}
      className="sm:max-w-2xl"
    >
      {product === undefined ? (
        <p className="py-10 text-center text-base text-muted" role="status">
          Loading
        </p>
      ) : product === null ? (
        <p className="py-10 text-center text-base text-muted" role="status">
          This item is no longer available.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[14rem_1fr]">
          <div>
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-tint">
              {image ? (
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 640px) 90vw, 224px"
                  unoptimized={image.src.endsWith(".svg")}
                  className="object-cover"
                />
              ) : null}
            </div>
            {product.images.length > 1 ? (
              <ul className="mt-2 flex gap-2" aria-label="Photographs">
                {product.images.map((img, i) => (
                  <li key={img.src}>
                    <button
                      type="button"
                      aria-label={`Photograph ${i + 1}`}
                      aria-pressed={i === shot}
                      onClick={() => setShot(i)}
                      className={cn(
                        "relative size-11 overflow-hidden border",
                        i === shot ? "border-primary" : "border-line",
                      )}
                    >
                      <Image
                        src={img.src}
                        alt=""
                        fill
                        sizes="44px"
                        unoptimized={img.src.endsWith(".svg")}
                        className="object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-subtle">
              {product.category}
              {product.deliveryType === "express" ? " · Same-day delivery" : ""}
            </p>
            <p className="tabular mt-1 text-xl font-semibold">{formatNaira(product.priceNgn)}</p>
            {product.description ? (
              <p className="mt-2 line-clamp-4 text-base text-muted">{product.description}</p>
            ) : null}
            <div className="mt-4">
              <PurchasePanel
                product={product}
                compact
                {...(edit ? { edit: { line: edit, onDone: () => onOpenChange(false) } } : {})}
                onAdded={() => onOpenChange(false)}
              />
            </div>
            <p className="mt-4">
              <Link
                href={`/products/${product.slug}`}
                className="inline-flex min-h-11 items-center text-base"
              >
                See the full page
              </Link>
            </p>
          </div>
        </div>
      )}
    </Sheet>
  );
}
