"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { formatNaira } from "@/lib/money";
import { wishlistProducts } from "@/server/actions/wishlist";
import type { Product } from "@/types/domain";
import { clearWishlist, removeFromWishlist, toggleWishlist, useWishlist } from "./store";

export function WishlistView() {
  const ids = useWishlist();
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const key = ids.join(",");

  useEffect(() => {
    let live = true;
    void wishlistProducts(key ? key.split(",") : []).then((items) => {
      if (live) setProducts(items);
    });
    return () => {
      live = false;
    };
  }, [key]);

  const visible = (products ?? []).filter((p) => ids.includes(p.id));

  if (products !== null && visible.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl">Nothing saved yet</h1>
        <p className="mt-3 text-base text-muted">Tap the heart on any piece to keep it here.</p>
        <ButtonLink href="/shop" className="mt-8">
          Browse the shop
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 pt-6 sm:px-8 md:pt-10">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">Wishlist</h1>
      <p className="mt-1 text-base text-muted">{visible.length} saved</p>
      <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
        {visible.map((p) => (
          <li key={p.id} className="relative">
            <Link
              href={`/products/${p.slug}`}
              className="block text-ink no-underline hover:text-ink"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-tint">
                {p.images[0] ? (
                  <Image
                    src={p.images[0].src}
                    alt={p.images[0].alt}
                    fill
                    sizes="(max-width: 767px) 50vw, 25vw"
                    unoptimized={p.images[0].src.endsWith(".svg")}
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="mt-3 flex flex-col gap-1">
                {p.isNew ? <Badge tone="new">New</Badge> : null}
                <h2 className="line-clamp-2 font-sans text-base leading-snug font-normal">
                  {p.name}
                </h2>
                <p className="tabular text-base font-medium">{formatNaira(p.priceNgn)}</p>
              </div>
            </Link>
            <button
              type="button"
              aria-label={`Remove ${p.name} from wishlist`}
              className="absolute top-0 right-0 flex size-11 items-center justify-center text-ink"
              onClick={() => {
                removeFromWishlist(p.id);
                toast.show(`${p.name} removed`, {
                  action: { label: "Undo", run: () => toggleWishlist(p.id) },
                });
              }}
            >
              <Trash2 size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <ButtonLink href={`/products/${p.slug}`} variant="secondary" block className="mt-3">
              Choose options
            </ButtonLink>
          </li>
        ))}
      </ul>
      <div className="mt-12 flex justify-end">
        <Button variant="secondary" onClick={() => setConfirmClear(true)}>
          Clear wishlist
        </Button>
      </div>
      <Sheet
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear your wishlist?"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmClear(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                clearWishlist();
                setConfirmClear(false);
              }}
            >
              Clear wishlist
            </Button>
          </div>
        }
      >
        <p className="text-base text-muted">All saved pieces will be removed.</p>
      </Sheet>
    </div>
  );
}
