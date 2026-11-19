import { describe, expect, it } from "vitest";
import { buildCsp, SECURITY_HEADERS } from "@/lib/csp";

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
  it("allows images from the configured storage origin, so signed receipt links show", () => {
    const local = buildCsp({ nonce: "x", supabaseUrl: "http://127.0.0.1:54321", isDev: false });
    expect(local.split("; ").find((d) => d.startsWith("img-src"))).toContain(
      "http://127.0.0.1:54321",
    );
  });
  it("allows Cloudinary images and sets framing and opener headers", () => {
    expect(csp.split("; ").find((d) => d.startsWith("img-src"))).toContain(
      "https://res.cloudinary.com",
    );
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });
});
