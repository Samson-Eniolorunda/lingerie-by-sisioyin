import type { Metadata } from "next";
import { CheckoutView } from "@/features/checkout/CheckoutView";
import { HasBar } from "@/features/shell/HasBar";
import { currentUser } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
  alternates: { canonical: "/checkout" },
};

export default async function CheckoutPage() {
  // A signed-in customer's own e-mail and saved details, never what an earlier guest order left in the browser.
  const user = await currentUser("customer");
  const home = user
    ? ((await data.account.addresses(user.id)).find((a) => a.isDefault) ?? null)
    : null;
  const account = user
    ? {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: home?.phone ?? "",
        address: home?.line1 ?? "",
        city: home?.city ?? "",
        state: home?.state ?? "",
      }
    : null;
  return (
    <>
      <HasBar />
      <CheckoutView account={account} />
    </>
  );
}
