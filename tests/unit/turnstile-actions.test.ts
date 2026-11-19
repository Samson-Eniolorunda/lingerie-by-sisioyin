import { afterEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const submit = vi.fn();
const requestPasswordReset = vi.fn();
vi.mock("@/server/data", () => ({
  data: { auth: { signIn, requestPasswordReset }, contact: { submit } },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirected");
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("forms refuse before anything is stored or sent", () => {
  it("sign-in, forgot password and contact stop when the check fails in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false }))),
    );
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const auth = await import("@/server/actions/auth");
    const contact = await import("@/server/actions/contact");
    const signed = await auth.signInAction(
      { email: "a@example.com", password: "Password-1", turnstileToken: "bad" },
      null,
    );
    expect(signed).toMatchObject({ ok: false, message: expect.stringContaining("security check") });
    const forgot = await auth.forgotAction({ email: "a@example.com", turnstileToken: "bad" });
    expect(forgot).toMatchObject({ ok: false, message: expect.stringContaining("security check") });
    const sent = await contact.sendContact({
      name: "Ada",
      email: "a@example.com",
      subject: "order",
      message: "Hello, I have a question about my order.",
      turnstileToken: "bad",
    });
    expect(sent).toMatchObject({ ok: false, message: expect.stringContaining("security check") });
    expect(signIn).not.toHaveBeenCalled();
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    write.mockRestore();
    vi.unstubAllGlobals();
  });
});
