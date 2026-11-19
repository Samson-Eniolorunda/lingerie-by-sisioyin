import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { adminPathFor, resolveAdminHost, stripAdminPrefix } from "@/lib/adminPath";
import { routeForHost } from "@/lib/adminRouting";

const SITE = "https://www.lingeriebysisioyin.store";
const ADMIN = "admin.lingeriebysisioyin.store";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolveAdminHost", () => {
  it("is on in production, from the site address without www", () => {
    expect(resolveAdminHost({ vercelEnv: "production", siteUrl: SITE })).toBe(ADMIN);
  });
  it("is off on previews and locally", () => {
    expect(resolveAdminHost({ vercelEnv: "preview", siteUrl: SITE })).toBeNull();
    expect(resolveAdminHost({ siteUrl: "http://localhost:3000" })).toBeNull();
    expect(
      resolveAdminHost({ vercelEnv: "production", siteUrl: "http://localhost:3000" }),
    ).toBeNull();
    expect(resolveAdminHost({ vercelEnv: "production", siteUrl: "not a url" })).toBeNull();
  });
  it("uses an explicit host anywhere, in lower case", () => {
    expect(resolveAdminHost({ adminHost: " Admin.Example.TEST ", vercelEnv: "preview" })).toBe(
      "admin.example.test",
    );
  });
});

describe("admin paths", () => {
  it("drops the prefix on the admin host and keeps it elsewhere", () => {
    expect(adminPathFor(ADMIN, "/orders")).toBe("/orders");
    expect(adminPathFor(ADMIN, "/")).toBe("/");
    expect(adminPathFor(null, "/orders?status=pending")).toBe("/admin/orders?status=pending");
    expect(adminPathFor(null, "/")).toBe("/admin");
  });
  it("accepts a path that already has the prefix", () => {
    expect(adminPathFor(null, "/admin/orders")).toBe("/admin/orders");
    expect(adminPathFor(ADMIN, "/admin/orders")).toBe("/orders");
    expect(adminPathFor(ADMIN, "/admin")).toBe("/");
    expect(stripAdminPrefix("/administrator")).toBe("/administrator");
  });
  it("builds absolute links for e-mails", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_HOST", ADMIN);
    const on = await import("@/lib/adminPath");
    expect(on.adminUrl("/orders/LBS-1", SITE)).toBe(`https://${ADMIN}/orders/LBS-1`);
    expect(on.adminPath("/team")).toBe("/team");
    expect(on.shopHref("/", SITE)).toBe(`${SITE}/`);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ADMIN_HOST", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    const off = await import("@/lib/adminPath");
    expect(off.adminUrl("/orders/LBS-1", "https://x.vercel.app/")).toBe(
      "https://x.vercel.app/admin/orders/LBS-1",
    );
    expect(off.adminUrl("/team")).toBe("/admin/team");
    expect(off.shopHref("/shop")).toBe("/shop");
  });
});

const route = (host: string, pathname: string, search = "", adminHost: string | null = ADMIN) =>
  routeForHost({ adminHost, host, pathname, search });

describe("routing by host", () => {
  it("leaves everything alone when the admin has no host of its own", () => {
    expect(route("localhost:3000", "/admin/orders", "", null)).toEqual({ kind: "pass" });
  });
  it("rewrites admin pages on the admin host", () => {
    expect(route(ADMIN, "/orders", "?status=pending")).toEqual({
      kind: "rewrite",
      path: "/admin/orders?status=pending",
    });
    expect(route(ADMIN, "/")).toEqual({ kind: "rewrite", path: "/admin" });
    expect(route(`${ADMIN}:443`, "/sign-in")).toEqual({ kind: "rewrite", path: "/admin/sign-in" });
    expect(route(ADMIN, "/api/upload")).toEqual({ kind: "rewrite", path: "/admin/api/upload" });
    expect(route(ADMIN, "/sw.js")).toEqual({ kind: "rewrite", path: "/admin/sw.js" });
    expect(route(ADMIN, "/manifest.webmanifest")).toEqual({
      kind: "rewrite",
      path: "/admin/manifest.webmanifest",
    });
  });
  it("keeps assets, the auth callback and the offline page working", () => {
    for (const p of [
      "/_next/static/a.js",
      "/auth/callback",
      "/offline",
      "/icons/icon-192.png",
      "/icon.svg",
    ])
      expect(route(ADMIN, p)).toEqual({ kind: "pass" });
  });
  it("redirects an old /admin address on the admin host to the plain one", () => {
    expect(route(ADMIN, "/admin/orders/LBS-1", "?x=1")).toEqual({
      kind: "redirect",
      path: "/orders/LBS-1?x=1",
    });
    expect(route(ADMIN, "/admin")).toEqual({ kind: "redirect", path: "/" });
    expect(route(ADMIN, "/%61dmin/orders")).toEqual({ kind: "notFound" });
  });
  it("answers robots.txt itself and has no sitemap", () => {
    expect(route(ADMIN, "/robots.txt")).toEqual({ kind: "robots" });
    expect(route(ADMIN, "/sitemap.xml")).toEqual({ kind: "notFound" });
  });
  it("gives a plain 404 for /admin on the shop host, without redirecting", () => {
    for (const p of [
      "/admin",
      "/admin/",
      "/admin/orders",
      "/ADMIN/orders",
      "/%61dmin/team",
      "//admin",
    ])
      expect(route("www.lingeriebysisioyin.store", p)).toEqual({ kind: "notFound" });
    expect(route("www.lingeriebysisioyin.store", "/shop")).toEqual({ kind: "pass" });
    expect(route("www.lingeriebysisioyin.store", "/administrators")).toEqual({ kind: "pass" });
  });
});

describe("the proxy", () => {
  async function run(env: Record<string, string>, url: string, host: string) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const { proxy } = await import("@/proxy");
    return proxy(new NextRequest(url, { headers: { host } }));
  }
  const production = {
    VERCEL_ENV: "production",
    NEXT_PUBLIC_VERCEL_ENV: "production",
    NEXT_PUBLIC_SITE_URL: SITE,
  };

  it("rewrites on the admin host, with the security headers and no indexing", async () => {
    const res = await run(production, `https://${ADMIN}/orders`, ADMIN);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/admin/orders");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("content-security-policy")).toContain("'nonce-");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
  it("answers 404 for /admin on the shop host and does not mark the shop noindex", async () => {
    const res = await run(production, `${SITE}/admin/orders`, "www.lingeriebysisioyin.store");
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBeNull();
    expect(res.headers.get("content-security-policy")).toBeTruthy();
  });
  it("redirects a prefixed address on the admin host", async () => {
    const res = await run(production, `https://${ADMIN}/admin/team`, ADMIN);
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/team");
  });
  it("changes nothing on a preview", async () => {
    const res = await run(
      { VERCEL_ENV: "preview", NEXT_PUBLIC_VERCEL_ENV: "preview", NEXT_PUBLIC_SITE_URL: SITE },
      "https://lbs-git-x-team.vercel.app/admin/orders",
      "lbs-git-x-team.vercel.app",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("auth e-mail links for staff", () => {
  it("return to the admin host in production, and the host is allowed", async () => {
    vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    const { callbackUrl, hostAllowed } = await import("@/server/auth/request");
    expect(await callbackUrl("/reset-password", "staff")).toBe(
      `https://${ADMIN}/auth/callback?next=%2Freset-password&aud=staff`,
    );
    expect(await callbackUrl("/reset-password")).toBe(
      `${SITE}/auth/callback?next=%2Freset-password&aud=customer`,
    );
    expect(hostAllowed(ADMIN)).toBe(true);
    expect(hostAllowed("admin.evil.example")).toBe(false);
  });
});
