"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Search, ShoppingBag, Store, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { cartCount, useCart } from "@/features/cart/store";
import { useShell } from "@/features/shell/ShellContext";
import { useWishlist } from "@/features/wishlist/store";

const itemClass =
  "relative flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs no-underline";

/** Shop, Search, Wishlist, Bag (live count) and Account, inside the bottom inset. Phones only. */
export function BottomNav() {
  const pathname = usePathname();
  const shell = useShell();
  const bag = cartCount(useCart());
  const saved = useWishlist().length;

  const active = (href: string) =>
    href === "/shop"
      ? pathname.startsWith("/shop") || pathname.startsWith("/products")
      : pathname.startsWith(href);
  const tone = (on: boolean) => (on ? "font-medium text-primary" : "text-muted");

  return (
    <nav
      aria-label="Main"
      data-print="hide"
      data-keyboard-hide
      className="fixed inset-x-0 bottom-0 z-[var(--z-bar)] flex border-t border-line bg-surface pr-[var(--safe-right)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] md:hidden"
    >
      <Link
        href="/shop"
        aria-current={active("/shop") ? "page" : undefined}
        className={cn(itemClass, tone(active("/shop")))}
      >
        <Store size={24} strokeWidth={1.5} aria-hidden="true" />
        Shop
      </Link>
      <button
        type="button"
        onClick={() => shell.open("search")}
        className={cn(itemClass, tone(false))}
      >
        <Search size={24} strokeWidth={1.5} aria-hidden="true" />
        Search
      </button>
      <Link
        href="/wishlist"
        aria-current={active("/wishlist") ? "page" : undefined}
        className={cn(itemClass, tone(active("/wishlist")))}
      >
        <Heart size={24} strokeWidth={1.5} aria-hidden="true" />
        Wishlist
        {saved > 0 ? <span className="sr-only">, {saved} saved</span> : null}
      </Link>
      <button
        type="button"
        onClick={() => shell.open("bag")}
        className={cn(itemClass, tone(active("/cart")))}
      >
        <span className="relative">
          <ShoppingBag size={24} strokeWidth={1.5} aria-hidden="true" />
          {bag > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-2.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] leading-4 font-medium text-on-primary"
            >
              {bag}
            </span>
          ) : null}
        </span>
        Bag
        {bag > 0 ? <span className="sr-only">, {bag} items</span> : null}
      </button>
      <Link
        href="/dashboard"
        aria-current={active("/dashboard") ? "page" : undefined}
        className={cn(itemClass, tone(active("/dashboard")))}
      >
        <User size={24} strokeWidth={1.5} aria-hidden="true" />
        Account
      </Link>
    </nav>
  );
}
