"use client";

import Link from "next/link";
import { CATEGORY_LINKS, NAV, SUPPORT_LINKS } from "@/config/site";
import { Sheet } from "@/components/ui/Sheet";
import { useAccount } from "@/features/account/useAccount";
import { signOutAction } from "@/server/actions/auth";
import { ThemeControl } from "@/features/theme/ThemeControl";
import { useShell } from "./ShellContext";

const link = "flex min-h-12 items-center text-base text-ink no-underline hover:text-primary";

export function MenuSheet() {
  const shell = useShell();
  const account = useAccount(shell.panel === "menu");
  return (
    <Sheet
      side="left"
      open={shell.panel === "menu"}
      onOpenChange={(next) => (next ? shell.open("menu") : shell.close())}
      title="Menu"
    >
      <nav aria-label="Menu" className="flex flex-col gap-6">
        <div data-testid="menu-account" className="border-b border-line pb-5">
          {account.status === "signed-in" ? (
            <div>
              <p className="flex items-center gap-3 text-base">
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-full bg-primary text-sm font-medium text-on-primary"
                >
                  {account.initials}
                </span>
                <span>
                  <span className="block font-medium">Hello, {account.firstName}</span>
                  <Link
                    href="/dashboard"
                    onClick={shell.close}
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    Your account
                  </Link>
                </span>
              </p>
              <ul className="mt-2">
                <li>
                  <Link href="/dashboard/orders" onClick={shell.close} className={link}>
                    Your orders
                  </Link>
                </li>
                <li>
                  <form action={signOutAction}>
                    <button type="submit" className={`${link} w-full text-left`}>
                      Sign out
                    </button>
                  </form>
                </li>
              </ul>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/sign-up"
                onClick={shell.close}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-sm border border-control text-base font-medium text-ink no-underline hover:bg-tint hover:text-ink"
              >
                Create account
              </Link>
              <Link
                href="/sign-in"
                onClick={shell.close}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-sm bg-primary text-base font-medium text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
        <ul>
          <li>
            <Link href="/" onClick={shell.close} className={link}>
              Home
            </Link>
          </li>
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={shell.close} className={link}>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/shop?is_new=true" onClick={shell.close} className={link}>
              New arrivals
            </Link>
          </li>
          <li>
            <Link href="/cart" onClick={shell.close} className={link}>
              Bag
            </Link>
          </li>
          <li>
            <Link href="/wishlist" onClick={shell.close} className={link}>
              Wishlist
            </Link>
          </li>
        </ul>
        <div>
          <h2 className="text-sm font-medium tracking-wider text-subtle uppercase">Collections</h2>
          <ul className="mt-1">
            {CATEGORY_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={shell.close} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium tracking-wider text-subtle uppercase">Help</h2>
          <ul className="mt-1">
            {SUPPORT_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={shell.close} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium tracking-wider text-subtle uppercase">Theme</h2>
          <ThemeControl />
        </div>
      </nav>
    </Sheet>
  );
}
