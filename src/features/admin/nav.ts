import { can, type Permission } from "@/lib/permissions";
import type { StaffRole } from "@/types/account";

export interface AdminNavItem {
  readonly href: string;
  readonly label: string;
  readonly icon:
    | "dashboard"
    | "orders"
    | "receipts"
    | "products"
    | "messages"
    | "reviews"
    | "customers"
    | "promos"
    | "analytics"
    | "settings"
    | "team"
    | "activity";
  readonly permission: Permission | null;
  /** On phones the first four visible items sit in the bottom bar; the rest live under More. */
  readonly primary: boolean;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", permission: null, primary: true },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: "orders",
    permission: "orders.view",
    primary: true,
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: "products",
    permission: "products.manage",
    primary: true,
  },
  {
    href: "/admin/messages",
    label: "Messages",
    icon: "messages",
    permission: "messages.manage",
    primary: true,
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
    icon: "reviews",
    permission: "products.manage",
    primary: false,
  },
  {
    href: "/admin/receipts",
    label: "Receipts with no order",
    icon: "receipts",
    permission: "orders.view",
    primary: false,
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: "customers",
    permission: "customers.view",
    primary: false,
  },
  {
    href: "/admin/promos",
    label: "Promo codes",
    icon: "promos",
    permission: "promos.manage",
    primary: false,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: "analytics",
    permission: "analytics.view",
    primary: false,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "settings",
    permission: "settings.manage",
    primary: false,
  },
  {
    href: "/admin/team",
    label: "Roles and invites",
    icon: "team",
    permission: "roles.manage",
    primary: false,
  },
  {
    href: "/admin/activity",
    label: "Activity log",
    icon: "activity",
    permission: "roles.manage",
    primary: false,
  },
];

export function visibleNav(role: StaffRole | null): readonly AdminNavItem[] {
  return ADMIN_NAV.filter((item) => item.permission === null || can(role, item.permission));
}

export function isCurrent(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}
