/**
 * Where the admin panel is served.
 *
 * In production the panel has its own host (`admin.lingeriebysisioyin.store`) and the `/admin`
 * prefix is dropped: `admin.lingeriebysisioyin.store/orders` is the route `/admin/orders`. On
 * previews and on a developer's machine nothing changes: the panel stays under `/admin`. The helpers
 * here are the only place that knows which of the two applies, so every admin link, `href`,
 * `router.push` and `redirect()` goes through them. File-system routes, `revalidatePath` and
 * `revalidateTag` always keep the real `/admin` route.
 *
 * This module is used by server and browser code; it reads only values that are inlined at build time.
 */

export interface AdminHostEnv {
  /** `NEXT_PUBLIC_ADMIN_HOST`: an explicit host, which also switches the feature on (for testing). */
  readonly adminHost?: string | undefined;
  /** Vercel's environment name: only `production` switches the feature on by itself. */
  readonly vercelEnv?: string | undefined;
  /** `NEXT_PUBLIC_SITE_URL`: the admin host is `admin.` plus this site's host without `www.`. */
  readonly siteUrl?: string | undefined;
}

/** The admin host for this environment, or `null` when the panel stays under `/admin`. */
export function resolveAdminHost(env: AdminHostEnv): string | null {
  const explicit = (env.adminHost ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  if (env.vercelEnv !== "production") return null;
  try {
    const host = new URL(env.siteUrl ?? "").hostname.toLowerCase().replace(/^www\./, "");
    return host && host !== "localhost" ? `admin.${host}` : null;
  } catch {
    return null;
  }
}

// Each variable is read by its full name so the bundler can inline it for the browser. The
// Vercel environment name is copied into `NEXT_PUBLIC_VERCEL_ENV` by `next.config.ts`.
export const ADMIN_HOST: string | null = resolveAdminHost({
  adminHost: process.env.NEXT_PUBLIC_ADMIN_HOST,
  vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
});

const PREFIX = /^\/admin(?=\/|\?|#|$)/;

/** A path without the `/admin` prefix: `/admin/orders?x=1` becomes `/orders?x=1`; `/admin` becomes `/`. */
export function stripAdminPrefix(path: string): string {
  const stripped = path.replace(PREFIX, "");
  if (stripped === "") return "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

/** The in-app path of an admin page for a given host setting (see `adminPath`). */
export function adminPathFor(host: string | null, path = "/"): string {
  const bare = stripAdminPrefix(path.startsWith("/") ? path : `/${path}`);
  if (host) return bare;
  return bare === "/" ? "/admin" : `/admin${bare}`;
}

/**
 * The path to link to for an admin page, given with or without the `/admin` prefix:
 * `adminPath("/orders")` is `/orders` on the admin host and `/admin/orders` elsewhere.
 */
export function adminPath(path = "/"): string {
  return adminPathFor(ADMIN_HOST, path);
}

/**
 * An absolute address for e-mails and messages. On the admin host it is always
 * `https://<admin host><path>`. Elsewhere it is `origin` (the deployment's own address) plus
 * `/admin<path>`; with no `origin` it stays a path.
 */
export function adminUrl(path = "/", origin = ""): string {
  if (ADMIN_HOST) return `https://${ADMIN_HOST}${adminPathFor(ADMIN_HOST, path)}`;
  return `${origin.replace(/\/$/, "")}${adminPathFor(null, path)}`;
}

/** A shop page as seen from the admin: absolute on the admin host (a different site), a path elsewhere. */
export function shopHref(path = "/", siteUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!ADMIN_HOST) return p;
  const base = (siteUrl || "").replace(/\/$/, "");
  return base ? `${base}${p}` : p;
}
