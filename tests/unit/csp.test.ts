import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";

describe("content security policy", () => {
  const csp = buildCsp({ nonce: "abc", supabaseUrl: "https://example.supabase.co", isDev: false });
  const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";

  it("SEC-19 has a nonce and no unsafe-inline or unsafe-eval for scripts", () => {
    expect(scriptSrc).toContain("'nonce-abc'");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });
  it("forbids framing and plugins", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it("allows the Supabase origin and its websocket only when configured", () => {
    expect(csp).toContain("https://example.supabase.co");
    expect(csp).toContain("wss://example.supabase.co");
    const bare = buildCsp({ nonce: "x", isDev: false })
      .split("; ")
      .find((d) => d.startsWith("connect-src"));
    expect(bare).not.toContain("supabase");
  });
});
