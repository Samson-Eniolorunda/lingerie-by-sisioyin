import type { StaffRole } from "@/types/account";

export type Permission =
  | "products.manage"
  | "orders.view"
  | "orders.update"
  | "customers.view"
  | "customers.manage"
  | "promos.manage"
  | "messages.manage"
  | "analytics.view"
  | "settings.manage"
  | "roles.manage";

const EDITOR: readonly Permission[] = [
  "products.manage",
  "orders.view",
  "orders.update",
  "messages.manage",
];

const ALL: readonly Permission[] = [
  ...EDITOR,
  "customers.view",
  "customers.manage",
  "promos.manage",
  "analytics.view",
  "settings.manage",
  "roles.manage",
];

/**
 * Role permissions. An editor adds and edits products, works orders and answers messages; the other
 * three roles have full access. The owner's decision on editor permissions and the developer role is
 * still open (plan 9.6), so this table is the one place to change.
 */
export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  owner: ALL,
  super_admin: ALL,
  developer: ALL,
  editor: EDITOR,
};

export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false;
}

export const ROLE_LABELS: Readonly<Record<StaffRole, string>> = {
  owner: "Owner",
  super_admin: "Super admin",
  developer: "Developer",
  editor: "Editor",
};

/** Owner and developer accounts cannot be demoted or removed from the screen. */
export function isProtectedRole(role: StaffRole): boolean {
  return role === "owner" || role === "developer";
}
