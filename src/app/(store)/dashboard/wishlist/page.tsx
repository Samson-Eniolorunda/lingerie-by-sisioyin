import type { Metadata } from "next";
import { WishlistView } from "@/features/wishlist/WishlistView";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };

export default function AccountWishlistPage() {
  return <WishlistView />;
}
