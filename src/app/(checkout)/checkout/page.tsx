import type { Metadata } from "next";
import { CheckoutView } from "@/features/checkout/CheckoutView";
import { HasBar } from "@/features/shell/HasBar";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
  alternates: { canonical: "/checkout" },
};

export default function CheckoutPage() {
  return (
    <>
      <HasBar />
      <CheckoutView />
    </>
  );
}
