"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { clearCheckoutStorage } from "@/features/checkout/saved-form";
import { signOutAction } from "@/server/actions/auth";

const ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/wishlist", label: "Wishlist" },
  { href: "/dashboard/addresses", label: "Addresses" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

/** Wrapping rows of 44 px links on phones (every item, Sign out included, is visible without swiping), a vertical list from 1024 px. The current page is marked; Sign out ends the list. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Account"
      className="-mx-4 border-b border-line px-4 lg:mx-0 lg:border-b-0 lg:px-0"
    >
      <ul className="flex flex-wrap gap-x-1 lg:flex-col">
        {ITEMS.map((item) => {
          const current =
            item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-b-2 px-3 text-base no-underline lg:border-b-0 lg:border-l-2",
                  current
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0">
          <form action={signOutAction} onSubmit={clearCheckoutStorage}>
            <button
              type="submit"
              className="flex min-h-11 items-center border-b-2 border-transparent px-3 text-base text-muted hover:text-ink lg:border-b-0 lg:border-l-2"
            >
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
