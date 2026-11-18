import type { Metadata } from "next";
import { AddressManager } from "@/features/account/AddressManager";
import { requireCustomer } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Addresses", robots: { index: false, follow: false } };

export default async function AddressesPage() {
  const user = await requireCustomer("/dashboard/addresses");
  const addresses = await data.account.addresses(user.id);
  return (
    <div>
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">Addresses</h1>
      <p className="mt-2 text-base text-muted">Up to five places we can deliver to.</p>
      <AddressManager addresses={addresses} />
    </div>
  );
}
