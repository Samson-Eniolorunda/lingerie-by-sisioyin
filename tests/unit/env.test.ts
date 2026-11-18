import { describe, expect, it } from "vitest";
import { publicEnv, serverEnv } from "@/config/env";

describe("environment", () => {
  it("applies safe defaults for public values", () => {
    expect(publicEnv.NEXT_PUBLIC_SITE_URL).toMatch(/^https?:\/\//);
    expect(publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER).toMatch(/^\d+$/);
  });
  it("names the missing server variables instead of failing quietly", () => {
    expect(() => serverEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
