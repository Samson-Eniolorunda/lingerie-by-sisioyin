import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_HOST } from "@/lib/adminPath";
import { routeForHost, type AdminRouting } from "@/lib/adminRouting";
import { buildCsp, SECURITY_HEADERS } from "@/lib/csp";
import { refreshSupabaseSession } from "@/lib/supabase-proxy";

const NOINDEX = "noindex, nofollow";

/** Adds the security headers, and keeps the whole admin host out of search results. */
function finish(response: NextResponse, csp: string, onAdminHost: boolean): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  if (onAdminHost) response.headers.set("X-Robots-Tag", NOINDEX);
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    isDev: process.env.NODE_ENV !== "production",
    upgradeInsecure: request.nextUrl.protocol === "https:",
  });

  const host = request.headers.get("host") ?? request.nextUrl.host;
  const routing: AdminRouting = routeForHost({
    adminHost: ADMIN_HOST,
    host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
  const onAdminHost = isAdminHost(host);

  if (routing.kind === "notFound")
    return finish(
      new NextResponse("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
      csp,
      onAdminHost,
    );
  if (routing.kind === "robots")
    return finish(
      new NextResponse("User-agent: *\nDisallow: /\n", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
      csp,
      true,
    );
  if (routing.kind === "redirect") {
    const target = request.nextUrl.clone();
    const [pathname = "/", search = ""] = splitPath(routing.path);
    target.pathname = pathname;
    target.search = search;
    return finish(NextResponse.redirect(target, 308), csp, true);
  }

  // Built again by the refresh if the session cookies change, from the request that now holds them.
  const makeResponse = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    if (routing.kind === "rewrite") {
      const target = request.nextUrl.clone();
      const [pathname = "/", search = ""] = splitPath(routing.path);
      target.pathname = pathname;
      target.search = search;
      return NextResponse.rewrite(target, { request: { headers } });
    }
    return NextResponse.next({ request: { headers } });
  };
  // A prefetch of an admin page only needs the rewrite; it does not renew anyone's session.
  const response = request.headers.has("next-router-prefetch")
    ? makeResponse()
    : await refreshSupabaseSession(request, makeResponse, {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
      });
  return finish(response, csp, onAdminHost);
}

function isAdminHost(host: string): boolean {
  return ADMIN_HOST !== null && (host.split(":")[0] ?? "").toLowerCase() === ADMIN_HOST;
}

function splitPath(path: string): [string, string] {
  const at = path.indexOf("?");
  return at === -1 ? [path, ""] : [path.slice(0, at), path.slice(at)];
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons/).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
    // The admin host also needs its prefetches rewritten, or `/orders` would not find `/admin/orders`.
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons/).*)",
      has: [{ type: "host", value: "admin\\..+" }],
    },
  ],
};
