import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { serviceWorkerSource } from "@/lib/service-worker";

describe("PWA", () => {
  it("Q-01 the storefront manifest is standalone with maskable and plain icons", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.icons?.some((i) => i.purpose === "maskable")).toBe(true);
    expect(m.icons?.some((i) => i.sizes === "512x512" && i.purpose === undefined)).toBe(true);
  });
  it("the worker never caches pages, the account, the bag or the API: only the offline page and icons", () => {
    const source = serviceWorkerSource("lbs-test", "/");
    expect(source).toContain('["/offline", "/icons/icon-192.png", "/icons/icon-512.png"]');
    expect(source).not.toMatch(/cache\.put|\/dashboard|\/checkout|\/cart|\/api/);
    expect(source).toContain('request.method !== "GET"');
    expect(source).toContain("SKIP_WAITING");
  });
  it("the worker source is valid JavaScript for both scopes", () => {
    expect(() => new Script(serviceWorkerSource("lbs-store-v1", "/"))).not.toThrow();
    expect(() => new Script(serviceWorkerSource("lbs-admin-v1", "/admin"))).not.toThrow();
  });
  it("each scope has its own cache name and removes older lbs- caches", () => {
    expect(serviceWorkerSource("lbs-admin-v1", "/admin")).toContain('"lbs-admin-v1"');
    expect(serviceWorkerSource("lbs-admin-v1", "/admin")).toContain('k.startsWith("lbs-")');
  });
});
