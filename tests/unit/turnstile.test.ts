import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TURNSTILE_FIELD,
  TURNSTILE_TEST_SECRET_KEY,
  TURNSTILE_TEST_SITE_KEY,
  turnstileSiteKey,
} from "@/lib/turnstile";
import { buildCsp } from "@/lib/csp";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const answer = (body: unknown, ok = true) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import("@/server/turnstile");
}

describe("verifyTurnstile", () => {
  it("accepts a token Cloudflare approves, sending the secret, token and address", async () => {
    const { verifyTurnstile } = await load({
      VERCEL_ENV: "production",
      TURNSTILE_SECRET_KEY: "real-secret",
    });
    const fetcher = answer({ success: true });
    expect(await verifyTurnstile("tok", "1.2.3.4", fetcher)).toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("real-secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses a token Cloudflare rejects, and a missing token without calling it", async () => {
    const { verifyTurnstile } = await load({
      VERCEL_ENV: "production",
      TURNSTILE_SECRET_KEY: "real-secret",
    });
    const rejected = await verifyTurnstile("tok", "1.2.3.4", answer({ success: false }));
    expect(rejected).toMatchObject({
      ok: false,
      message: expect.stringContaining("security check"),
    });
    const fetcher = answer({ success: true });
    expect(await verifyTurnstile(undefined, "1.2.3.4", fetcher)).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses when Cloudflare times out, errors or cannot be reached", async () => {
    const { verifyTurnstile } = await load({
      VERCEL_ENV: "production",
      TURNSTILE_SECRET_KEY: "real-secret",
    });
    const timeout = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    expect(await verifyTurnstile("tok", "ip", timeout)).toMatchObject({ ok: false });
    expect(await verifyTurnstile("tok", "ip", answer({}, false))).toMatchObject({ ok: false });
  });

  it("fails closed in production without the secret, and names the variable", async () => {
    const { verifyTurnstile } = await load({ VERCEL_ENV: "production", TURNSTILE_SECRET_KEY: "" });
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const fetcher = answer({ success: true });
    expect(await verifyTurnstile("tok", "ip", fetcher)).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
    expect(String(write.mock.calls[0]?.[0])).toContain("TURNSTILE_SECRET_KEY");
    write.mockRestore();
  });

  it("uses Cloudflare's always-pass test secret on a preview", async () => {
    const { verifyTurnstile } = await load({
      VERCEL_ENV: "preview",
      TURNSTILE_SECRET_KEY: "ignored",
    });
    const fetcher = answer({ success: true });
    await verifyTurnstile("tok", "ip", fetcher);
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.body as URLSearchParams).get("secret")).toBe(TURNSTILE_TEST_SECRET_KEY);
  });

  it("skips the check on the development store and where no key is set", async () => {
    const { verifyTurnstile } = await load({ TURNSTILE_SECRET_KEY: "" });
    const fetcher = answer({ success: false });
    expect(await verifyTurnstile(undefined, "ip", fetcher)).toEqual({ ok: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads the token from the form's input", async () => {
    const { turnstileTokenOf } = await load({});
    expect(turnstileTokenOf({ [TURNSTILE_FIELD]: "abc", email: "a@b.co" })).toBe("abc");
    expect(turnstileTokenOf({ [TURNSTILE_FIELD]: 5 })).toBeUndefined();
    expect(turnstileTokenOf(null)).toBeUndefined();
  });
});

describe("the widget's site key and the policy", () => {
  it("uses the test site key on a preview, the configured key elsewhere, none when unset", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(turnstileSiteKey()).toBe(TURNSTILE_TEST_SITE_KEY);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "live-site-key");
    expect(turnstileSiteKey()).toBe("live-site-key");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect(turnstileSiteKey()).toBeNull();
  });

  it("allows the Turnstile script and frame, and no reCAPTCHA", () => {
    const csp = buildCsp({ nonce: "n", isDev: false });
    const directive = (name: string) => csp.split("; ").find((d) => d.startsWith(name)) ?? "";
    expect(directive("script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive("frame-src")).toContain("https://challenges.cloudflare.com");
    expect(csp.toLowerCase()).not.toContain("recaptcha");
  });
});
