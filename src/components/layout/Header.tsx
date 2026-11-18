"use client";

import Link from "next/link";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { NAV } from "@/config/site";
import { cartCount, useCart } from "@/features/cart/store";
import { useShell } from "@/features/shell/ShellContext";
import { IconButton } from "@/components/ui/Button";
import { Wordmark } from "@/components/brand/Wordmark";

/** 56 px plus the top inset on phones: the wordmark and the menu only. Search, wishlist, bag and account live in the bottom navigation. */
export function Header() {
  const shell = useShell();
  const count = cartCount(useCart());
  return (
    <header
      data-print="hide"
      className="sticky top-0 z-[var(--z-header)] border-b border-line bg-page pt-[var(--safe-top)]"
    >
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-4 px-[max(var(--gutter),var(--safe-left))] sm:h-[72px] sm:px-8">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-h-11 content-center text-base text-ink no-underline hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center">
          <IconButton label="Search" onClick={() => shell.open("search")} className="max-md:hidden">
            <Search size={20} strokeWidth={1.5} />
          </IconButton>
          <Link
            href="/dashboard"
            aria-label="Account"
            className="inline-flex size-11 items-center justify-center text-ink hover:bg-tint max-md:hidden"
          >
            <User size={20} strokeWidth={1.5} />
          </Link>
          <IconButton
            label={count > 0 ? `Bag, ${count} items` : "Bag"}
            onClick={() => shell.open("bag")}
            className="max-md:hidden"
          >
            <ShoppingBag size={20} strokeWidth={1.5} />
            {count > 0 ? (
              <span className="absolute top-0.5 right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs leading-5 font-medium text-on-primary">
                {count}
              </span>
            ) : null}
          </IconButton>
          <IconButton label="Menu" onClick={() => shell.open("menu")} className="md:hidden">
            <Menu size={22} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
