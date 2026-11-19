import type { Metadata } from "next";
import { WishlistView } from "@/features/wishlist/WishlistView";

export const metadata: Metadata = { title: "Wishlist", alternates: { canonical: "/wishlist" } };

export default function WishlistPage() {
  return <WishlistView />;
}
