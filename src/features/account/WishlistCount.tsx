"use client";

import { useWishlist } from "@/features/wishlist/store";

export function WishlistCount() {
  return <>{useWishlist().length}</>;
}
