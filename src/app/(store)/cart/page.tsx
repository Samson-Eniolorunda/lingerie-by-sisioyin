import type { Metadata } from "next";
import { CartView } from "@/features/cart/CartView";
import { HasBar } from "@/features/shell/HasBar";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cart" },
};

export default function CartPage() {
  return (
    <>
      <HasBar />
      <CartView />
    </>
  );
}
