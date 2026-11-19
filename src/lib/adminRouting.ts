import { stripAdminPrefix } from "@/lib/adminPath";

/** What the proxy does with a request once the admin host is switched on. */
export type AdminRouting =
  | { readonly kind: "pass" }
  | { readonly kind: "notFound" }
  | { readonly kind: "robots" }
  | { readonly kind: "redirect"; readonly path: string }
  | { readonly kind: "rewrite"; readonly path: string };

export interface RoutingInput {
  /** The admin host, or `null` when the panel stays under `/admin` (previews, local development). */
  readonly adminHost: string | null;
  /** The request's `Host` header. */
  readonly host: string;
  readonly pathname: string;
  readonly search: string;
}

/** Lower-case host without a port. */
export function bareHost(host: string): string {
  return (host.split(",")[0] ?? "").trim().toLowerCase().split(":")[0] ?? "";
}

/**
 * The path as the router will read it: percent-escapes decoded, repeated slashes collapsed and
 * lower-cased, so `/%41dmin` or `//admin` cannot slip past a prefix check.
 */
export function canonicalPath(pathname: string): string {
  let decoded = pathname;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.replace(/[\/]+/g, "/").toLowerCase();
}

const isAdminRoute = (path: string): boolean => path === "/admin" || path.startsWith("/admin/");

// Served on the admin host as they are: Next's own files, the auth callback (Supabase sends people
// back to it), and the generic offline page that the service worker stores.
const passesThrough = (path: string): boolean =>
  path.startsWith("/_next/") || path === "/auth/callback" || path === "/offline";
// Files that are admin routes, not files in `public`.
const ADMIN_FILES = new Set(["/manifest.webmanifest", "/sw.js"]);
// Static files from `public` (icons, placeholders) are the same on both hosts.
const STATIC_FILE = /\.[a-z0-9]{2,5}$/;

/**
 * Decides how a request is handled when the admin panel has its own host.
 *
 * - On the admin host `/x` is served from the route `/admin/x`; a path that already starts with
 *   `/admin` is sent to the prefix-less address; everything that is not an admin route (the shop's
 *   pages and its API) is therefore a 404 there.
 * - On every other host `/admin` and everything under it is a plain 404, with no redirect, so
 *   nothing reveals that the panel exists.
 */
export function routeForHost({ adminHost, host, pathname, search }: RoutingInput): AdminRouting {
  if (!adminHost) return { kind: "pass" };
  const path = canonicalPath(pathname);

  if (bareHost(host) !== adminHost)
    return isAdminRoute(path) ? { kind: "notFound" } : { kind: "pass" };

  if (path === "/robots.txt") return { kind: "robots" };
  if (path === "/sitemap.xml") return { kind: "notFound" };
  const raw = pathname.replace(/\/{2,}/g, "/");
  if (isAdminRoute(path)) {
    // Only the exact prefix is redirected; a disguised one (`/%61dmin`) is refused.
    return /^\/admin(\/|$)/.test(raw)
      ? { kind: "redirect", path: `${stripAdminPrefix(raw)}${search}` }
      : { kind: "notFound" };
  }
  if (passesThrough(path)) return { kind: "pass" };
  if (!ADMIN_FILES.has(path) && STATIC_FILE.test(path)) return { kind: "pass" };
  return { kind: "rewrite", path: `${raw === "/" ? "/admin" : `/admin${raw}`}${search}` };
}
