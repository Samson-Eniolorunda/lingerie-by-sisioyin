"use client";

import { adminPath, shopHref } from "@/lib/adminPath";
import {
  Activity,
  BarChart3,
  Boxes,
  FileQuestion,
  LayoutDashboard,
  Mail,
  Menu,
  ReceiptText,
  Star,
  Settings,
  Tag,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ToastProvider } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ROLE_LABELS } from "@/lib/permissions";
import { staffSignOutAction } from "@/server/actions/auth";
import type { StaffRole } from "@/types/account";
import { ServiceWorkerRegistrar } from "../pwa/ServiceWorkerRegistrar";
import { ThemeControl } from "../theme/ThemeControl";
import { isCurrent, type AdminNavItem } from "./nav";

const ICONS: Record<AdminNavItem["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ReceiptText,
  receipts: FileQuestion,
  products: Boxes,
  messages: Mail,
  reviews: Star,
  customers: Users,
  promos: Tag,
  analytics: BarChart3,
  settings: Settings,
  team: UserCog,
  activity: Activity,
};

interface Props {
  readonly items: readonly AdminNavItem[];
  readonly name: string;
  readonly role: StaffRole;
  readonly badges: Readonly<Record<string, number>>;
  readonly children: ReactNode;
}

function Badge({ count }: { readonly count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-5 font-medium text-on-primary lg:ml-2">
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{count} new</span>
    </span>
  );
}

/**
 * The staff frame. On phones: a slim top bar and a bottom bar of the four daily screens plus More,
 * inside the safe areas. From 1024 px: a fixed side column. Both are hidden when printing.
 */
export function AdminShell({ items, name, role, badges, children }: Props) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const primary = items.filter((i) => i.primary);
  const secondary = items.filter((i) => !i.primary);
  const current = items.find((i) => isCurrent(pathname, i.href));

  return (
    <ToastProvider>
      <ServiceWorkerRegistrar script={adminPath("/sw.js")} scope={adminPath("/")} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <header
        data-admin-chrome
        className="sticky top-0 z-[var(--z-bar)] flex min-h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 pt-[var(--safe-top)] lg:pl-[17rem]"
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="font-display text-xl font-semibold tracking-[0.16em] uppercase lg:hidden">
            Admin
          </span>
          <h1 className="sr-only">{current?.label ?? "Admin"}</h1>
          <span className="truncate text-sm text-muted lg:hidden" aria-hidden="true">
            {current?.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeControl className="hidden sm:inline-flex" />
          <Link
            href={shopHref("/")}
            className="hidden min-h-11 items-center text-sm text-muted underline underline-offset-4 sm:inline-flex"
          >
            View the shop
          </Link>
        </div>
      </header>

      <aside
        data-admin-chrome
        className="fixed inset-y-0 left-0 z-[var(--z-bar)] hidden w-64 flex-col border-r border-line bg-surface p-4 lg:flex"
      >
        <p className="font-display text-2xl font-semibold tracking-[0.18em] uppercase">Admin</p>
        <p className="mt-1 text-sm text-muted">
          {name} · {ROLE_LABELS[role]}
        </p>
        <nav aria-label="Admin" className="mt-6 flex-1 overflow-y-auto">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                count={badges[item.href] ?? 0}
              />
            ))}
          </ul>
        </nav>
        <form action={staffSignOutAction} className="mt-4 border-t border-line pt-4">
          <Button type="submit" variant="secondary" block>
            Sign out
          </Button>
        </form>
      </aside>

      <nav
        aria-label="Admin"
        data-admin-chrome
        data-keyboard-hide
        className="fixed inset-x-0 bottom-0 z-[var(--z-bar)] flex border-t border-line bg-surface pr-[var(--safe-right)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] lg:hidden"
      >
        {primary.map((item) => {
          const Icon = ICONS[item.icon];
          const on = isCurrent(pathname, item.href);
          const count = badges[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs no-underline",
                on ? "font-medium text-primary" : "text-muted",
              )}
            >
              <span className="relative">
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                {count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-2.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] leading-4 font-medium text-on-primary"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              {item.label}
              {count > 0 ? <span className="sr-only">, {count} new</span> : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted"
        >
          <Menu size={24} strokeWidth={1.5} aria-hidden="true" />
          More
        </button>
      </nav>

      <Sheet
        open={more}
        onOpenChange={setMore}
        title="More"
        description={`${name} · ${ROLE_LABELS[role]}`}
      >
        <ul className="flex flex-col">
          {secondary.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMore(false)}
                  className="flex min-h-12 items-center gap-3 border-b border-line text-base text-ink no-underline"
                >
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href={shopHref("/")}
              className="flex min-h-12 items-center gap-3 border-b border-line text-base text-ink no-underline"
            >
              View the shop
            </Link>
          </li>
        </ul>
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Theme</p>
            <ThemeControl />
          </div>
          <form action={staffSignOutAction}>
            <Button type="submit" variant="secondary" block>
              Sign out
            </Button>
          </form>
        </div>
      </Sheet>

      <main
        id="main"
        data-admin-main
        className="mx-auto w-full max-w-[1100px] px-4 pt-5 pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+2rem)] lg:ml-64 lg:w-auto lg:max-w-none lg:px-10 lg:pt-8 lg:pb-16"
      >
        <div className="lg:mx-auto lg:max-w-[1100px]">{children}</div>
      </main>
    </ToastProvider>
  );
}

function NavLink({
  item,
  pathname,
  count,
}: {
  readonly item: AdminNavItem;
  readonly pathname: string;
  readonly count: number;
}) {
  const Icon = ICONS[item.icon];
  const on = isCurrent(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={on ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-sm px-3 text-base no-underline",
          on ? "bg-selected font-medium text-ink" : "text-muted hover:bg-tint hover:text-ink",
        )}
      >
        <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
        {item.label}
        <Badge count={count} />
      </Link>
    </li>
  );
}
