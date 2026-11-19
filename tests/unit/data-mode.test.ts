import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function modeWith(env: Record<string, string>) {
  vi.resetModules();
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "LBS_ALLOW_DEMO",
  ])
    vi.stubEnv(name, "");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import("@/config/data-mode")).DATA_MODE;
}

describe("where data comes from", () => {
  it("uses Supabase whenever its address and key are set", async () => {
    expect(
      await modeWith({
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.test",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      }),
    ).toBe("supabase");
  });

  it("allows the development store on a developer's machine and where a demonstration asks for it", async () => {
    expect(await modeWith({ NODE_ENV: "development" })).toBe("mock");
    expect(await modeWith({ NODE_ENV: "production", LBS_ALLOW_DEMO: "true" })).toBe("mock");
  });

  it("never falls back to invented data in production", async () => {
    expect(await modeWith({ NODE_ENV: "production" })).toBe("unconfigured");
    // One of the two variables alone is not a configuration.
    expect(
      await modeWith({
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.test",
      }),
    ).toBe("unconfigured");
  });

  it("refuses every call, naming the missing variables, when nothing is configured", async () => {
    vi.resetModules();
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "LBS_ALLOW_DEMO",
    ])
      vi.stubEnv(name, "");
    vi.stubEnv("NODE_ENV", "production");
    const { data } = await import("@/server/data");
    expect(() => data.catalogue.list).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => data.orders.place).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => data.auth.currentUser).toThrow(/not configured/);
  });
});

describe("the demonstration switch on the live site", () => {
  it("is ignored when Vercel says this is Production", async () => {
    expect(
      await modeWith({ NODE_ENV: "production", LBS_ALLOW_DEMO: "true", VERCEL_ENV: "production" }),
    ).toBe("unconfigured");
    expect(
      await modeWith({ NODE_ENV: "production", LBS_ALLOW_DEMO: "true", VERCEL_ENV: "preview" }),
    ).toBe("mock");
  });

  it("never shows demonstration hints in Production", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LBS_ALLOW_DEMO", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await import("@/config/data-mode")).SHOW_DEMO_HINTS).toBe(false);
  });

  it("lifts the rate limit only on the development store, never in Production", async () => {
    const hitsMany = async (env: Record<string, string>) => {
      vi.resetModules();
      for (const n of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])
        vi.stubEnv(n, "");
      for (const [n, v] of Object.entries(env)) vi.stubEnv(n, v);
      const { allowShared } = await import("@/server/rate-limit");
      const key = `t:${Math.random()}`;
      const results = [];
      for (let i = 0; i < 3; i++) results.push(await allowShared(key, 1, 60_000));
      return results;
    };
    expect(await hitsMany({ NODE_ENV: "test", LBS_ALLOW_DEMO: "true" })).toEqual([
      true,
      true,
      true,
    ]);
    expect(
      await hitsMany({ NODE_ENV: "production", LBS_ALLOW_DEMO: "true", VERCEL_ENV: "production" }),
    ).toEqual([true, false, false]);
    expect(await hitsMany({ NODE_ENV: "test", LBS_ALLOW_DEMO: "false" })).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("uses an obvious placeholder, not a real account, in the development store", async () => {
    vi.resetModules();
    const { getDb } = await import("@/server/mock/db");
    expect(getDb().bank).toMatchObject({
      bankName: "Demonstration Bank",
      accountNumber: "0000000000",
      accountName: "DEMONSTRATION ONLY",
    });
  });
});
