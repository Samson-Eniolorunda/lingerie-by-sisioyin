import { adminPath } from "@/lib/adminPath";
import Link from "next/link";
import type { ReactNode } from "react";

/** Settings has two tabs: the shop itself, and payments (bank details and methods). */
export default function SettingsLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <nav aria-label="Settings sections" className="mb-5 flex gap-1 border-b border-line">
        <Link
          href={adminPath("/settings")}
          className="inline-flex min-h-11 items-center px-3 text-base"
        >
          The shop
        </Link>
        <Link
          href={adminPath("/settings/payments")}
          className="inline-flex min-h-11 items-center px-3 text-base"
        >
          Payments
        </Link>
      </nav>
      {children}
    </>
  );
}
