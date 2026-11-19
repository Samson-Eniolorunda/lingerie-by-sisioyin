import { afterEach, describe, expect, it, vi } from "vitest";

let incoming = new Headers();
vi.mock("next/headers", () => ({ headers: async () => incoming }));

afterEach(() => vi.unstubAllEnvs());

describe("clientIp", () => {
  it("prefers x-vercel-forwarded-for, then x-real-ip, then x-forwarded-for", async () => {
    const { clientIp } = await import("@/server/auth/request");
    incoming = new Headers({
      "x-forwarded-for": "6.6.6.6, 7.7.7.7",
      "x-real-ip": "5.5.5.5",
      "x-vercel-forwarded-for": "4.4.4.4",
    });
    expect(await clientIp()).toBe("4.4.4.4");
    incoming = new Headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "5.5.5.5" });
    expect(await clientIp()).toBe("5.5.5.5");
    incoming = new Headers({ "x-forwarded-for": "6.6.6.6, 7.7.7.7" });
    expect(await clientIp()).toBe("6.6.6.6");
    incoming = new Headers();
    expect(await clientIp()).toBe("unknown");
  });
});

describe("requestOrigin on a preview", () => {
  it("uses an allowed request host and ignores a forged one", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "lbs-abc123-team.vercel.app");
    vi.stubEnv("VERCEL_GIT_REPO_SLUG", "lingerie-by-sisioyin");
    const { requestOrigin, callbackUrl } = await import("@/server/auth/request");
    incoming = new Headers({
      host: "lingerie-by-sisioyin-git-rebuild-production-team.vercel.app",
    });
    expect(await requestOrigin()).toBe(
      "https://lingerie-by-sisioyin-git-rebuild-production-team.vercel.app",
    );
    expect(await callbackUrl("/reset-password")).toContain(
      "https://lingerie-by-sisioyin-git-rebuild-production-team.vercel.app/auth/callback",
    );
    incoming = new Headers({ "x-forwarded-host": "evil.example", host: "evil.example" });
    expect(await requestOrigin()).toBe("https://lbs-abc123-team.vercel.app");
  });

  it("ignores the request host outside previews", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { requestOrigin } = await import("@/server/auth/request");
    incoming = new Headers({ host: "lingerie-by-sisioyin-git-x-team.vercel.app" });
    expect(await requestOrigin()).not.toContain("vercel.app");
  });
});
