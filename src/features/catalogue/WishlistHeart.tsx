"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { toggleWishlist, useWishlist } from "@/features/wishlist/store";

/** A 44 px hit area around a 20 px heart; the saved state is the filled shape, not colour alone. */
export function WishlistHeart({
  productId,
  name,
  className,
}: {
  readonly productId: string;
  readonly name: string;
  readonly className?: string;
}) {
  const saved = useWishlist().includes(productId);
  const toast = useToast();
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={() => {
        const added = toggleWishlist(productId);
        toast.show(added ? "Saved to your wishlist" : "Removed from your wishlist", {
          tone: "info",
          durationMs: 2500,
        });
      }}
      className={cn("flex size-11 shrink-0 items-center justify-center text-ink", className)}
    >
      <Heart
        size={20}
        strokeWidth={1.5}
        className={saved ? "fill-primary text-primary" : ""}
        aria-hidden="true"
      />
    </button>
  );
}
