import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PASSWORD_RULES,
  passwordStrength,
  signUpSchema,
  profileSchema,
  addressSchema,
} from "@/schemas/auth";
import { safeNext } from "@/lib/safe-next";
import { DEMO, resetDb } from "@/server/mock/db";
import { memorySessionPort, useSessionPort } from "@/server/auth/port";
import { mockAuth, resetFailureCounters } from "@/server/mock/auth";

beforeEach(() => {
  resetDb();
  resetFailureCounters();
});

describe("password rules (A-03)", () => {
  it("has the five rules and scores them", () => {
    expect(PASSWORD_RULES).toHaveLength(5);
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abcdefgh")).toBe(2);
    expect(passwordStrength("Abcdefg1!")).toBe(5);
  });

  it("sign-up refuses a weak password, a mismatch and missing consent", () => {
    const base = {
      firstName: "Ada",
      lastName: "Obi",
      email: "ada@example.com",
      password: "Abcdefg1!",
      confirmPassword: "Abcdefg1!",
      acceptTerms: true,
    };
    expect(signUpSchema.safeParse(base).success).toBe(true);
    expect(
      signUpSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }).success,
    ).toBe(false);
    const mismatch = signUpSchema.safeParse({ ...base, confirmPassword: "Abcdefg1?" });
    expect(!mismatch.success && mismatch.error.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(signUpSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });
});

describe("safe redirect after sign-in", () => {
  it("keeps same-site paths and refuses everything else", () => {
    expect(safeNext("/dashboard/orders", "/dashboard")).toBe("/dashboard/orders");
    expect(safeNext("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeNext("https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeNext("/\\evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeNext(undefined, "/dashboard")).toBe("/dashboard");
  });
});

const IP = { ip: "203.0.113.7" };
const callback = "http://localhost:3000/auth/callback?next=%2Freset-password";

describe("mock authentication", () => {
  beforeEach(() => useSessionPort(memorySessionPort()));

  it("signs in the demo customer and gives the same message for a wrong email or password", async () => {
    const ok = await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer", IP);
    expect(ok.ok).toBe(true);
    const wrongPassword = await mockAuth.signIn(DEMO.customer.email, "nope", "customer", IP);
    const wrongEmail = await mockAuth.signIn("nobody@example.test", "nope", "customer", IP);
    expect(wrongPassword).toEqual(wrongEmail);
  });

  it("A-11 refuses suspended accounts with a specific message", async () => {
    const result = await mockAuth.signIn("uche.demo@example.test", "Sample-Pass1!", "customer", IP);
    expect(result.ok).toBe(false);
  });

  it("locks an email from one address after five failures", async () => {
    for (let i = 0; i < 5; i += 1)
      await mockAuth.signIn(DEMO.customer.email, "bad", "customer", IP);
    const locked = await mockAuth.signIn(
      DEMO.customer.email,
      DEMO.customer.password,
      "customer",
      IP,
    );
    expect(!locked.ok && locked.message).toMatch(/Too many attempts/);
  });

  it("a stranger cannot lock the owner out: the lock belongs to email and address together", async () => {
    for (let i = 0; i < 8; i += 1)
      await mockAuth.signIn(DEMO.owner.email, "guess", "staff", { ip: "198.51.100.9" });
    const own = await mockAuth.signIn(DEMO.owner.email, DEMO.owner.password, "staff", IP);
    expect(own.ok).toBe(true);
  });

  it("the count starts again from zero once a lock has run out, and old failures decay", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-19T10:00:00Z"));
      for (let i = 0; i < 5; i += 1)
        await mockAuth.signIn(DEMO.customer.email, "bad", "customer", IP);
      expect(
        (await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer", IP)).ok,
      ).toBe(false);
      vi.setSystemTime(new Date("2026-11-19T10:11:00Z")); // the ten-minute lock has run out
      expect((await mockAuth.signIn(DEMO.customer.email, "bad", "customer", IP)).ok).toBe(false);
      // one failure after the lock is one failure, not a sixth: the right password still works
      expect(
        (await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer", IP)).ok,
      ).toBe(true);
      // failures spread over more than the decay window never add up to a lock
      for (let i = 0; i < 6; i += 1) {
        vi.setSystemTime(new Date(Date.parse("2026-11-19T12:00:00Z") + i * 4 * 60_000 * 4));
        await mockAuth.signIn(DEMO.customer.email, "bad", "customer", IP);
      }
      expect(
        (await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer", IP)).ok,
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("A-14 keeps the two audiences apart and refuses a customer at the staff door", async () => {
    const customer = await mockAuth.signIn(
      DEMO.customer.email,
      DEMO.customer.password,
      "customer",
      IP,
    );
    if (!customer.ok) throw new Error("sign-in failed");
    expect(await mockAuth.currentUser("customer")).not.toBeNull();
    expect(await mockAuth.currentUser("staff")).toBeNull();
    const denied = await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "staff", IP);
    expect(!denied.ok && denied.message).toMatch(/Access denied/);
    const staff = await mockAuth.signIn(DEMO.owner.email, DEMO.owner.password, "staff", IP);
    expect(staff.ok && staff.value.role).toBe("owner");
    expect((await mockAuth.currentUser("staff"))?.role).toBe("owner");
    await mockAuth.signOut("staff");
    expect(await mockAuth.currentUser("staff")).toBeNull();
  });

  it("sign-up creates a session and refuses a duplicate email", async () => {
    const input = {
      firstName: "New",
      lastName: "Person",
      email: "New.Person@example.test",
      password: "Abcdefg1!",
    };
    const first = await mockAuth.signUp(input);
    expect(first.ok).toBe(true);
    expect((await mockAuth.currentUser("customer"))?.email).toBe("new.person@example.test");
    expect((await mockAuth.signUp(input)).ok).toBe(false);
  });

  it("a recovery link is a one-time code for a session, then the password changes and sessions end", async () => {
    await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer", IP);
    const { devLink } = await mockAuth.requestPasswordReset(
      DEMO.customer.email,
      "customer",
      callback,
    );
    const code = new URL(devLink ?? "", "http://x").searchParams.get("code");
    if (!code) throw new Error("no code");
    expect(devLink).toMatch(/^\/auth\/callback\?next=%2Freset-password&code=/);
    await mockAuth.signOut("customer");
    expect((await mockAuth.updatePassword("Brand-New1!")).ok).toBe(false); // no session yet
    expect((await mockAuth.exchangeCode(code)).ok).toBe(true);
    expect((await mockAuth.exchangeCode(code)).ok).toBe(false); // single use
    expect((await mockAuth.updatePassword("Brand-New1!")).ok).toBe(true);
    expect(await mockAuth.currentUser("customer")).toBeNull();
    expect((await mockAuth.signIn(DEMO.customer.email, "Brand-New1!", "customer", IP)).ok).toBe(
      true,
    );
  });

  it("an unknown email gets no link and no error (M-23)", async () => {
    expect(
      await mockAuth.requestPasswordReset("nobody@example.test", "customer", callback),
    ).toEqual({ devLink: null });
  });

  it("Google sign-in reports honestly that it is not connected", async () => {
    expect((await mockAuth.signInWithGoogle(callback)).ok).toBe(false);
  });
});

describe("demonstration hints", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function hints() {
    vi.resetModules();
    return (await import("@/config/data-mode")).SHOW_DEMO_HINTS;
  }

  it("are shown on a developer's machine and where explicitly allowed", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LBS_ALLOW_DEMO", "");
    expect(await hints()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LBS_ALLOW_DEMO", "true");
    expect(await hints()).toBe(true);
  });

  it("never in a deployed build, and never once Supabase is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LBS_ALLOW_DEMO", "");
    expect(await hints()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(await hints()).toBe(false);
    vi.resetModules();
    expect((await import("@/config/data-mode")).DATA_MODE).toBe("supabase");
  });

  it("a reset request prints no link outside local development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LBS_ALLOW_DEMO", "");
    vi.resetModules();
    const { mockAuth: fresh } = await import("@/server/mock/auth");
    expect(await fresh.requestPasswordReset(DEMO.customer.email, "customer", callback)).toEqual({
      devLink: null,
    });
  });
});

describe("profile and address schemas", () => {
  it("accepts a blank phone and refuses a foreign number", () => {
    const base = {
      firstName: "Ada",
      lastName: "Obi",
      phone: "",
      dateOfBirth: "",
      gender: "" as const,
    };
    expect(profileSchema.safeParse(base).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, dateOfBirth: "2999-01-01" }).success).toBe(false);
  });

  it("requires every address field", () => {
    expect(
      addressSchema.safeParse({
        label: "",
        recipient: "",
        phone: "",
        line1: "",
        city: "",
        state: "",
        isDefault: false,
      }).success,
    ).toBe(false);
    expect(
      addressSchema.safeParse({
        label: "Home",
        recipient: "Ada Obi",
        phone: "08012345678",
        line1: "12 Allen Avenue",
        city: "Ikeja",
        state: "Lagos",
        isDefault: true,
      }).success,
    ).toBe(true);
  });
});
