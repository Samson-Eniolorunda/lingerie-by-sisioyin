import { beforeEach, describe, expect, it } from "vitest";
import {
  PASSWORD_RULES,
  passwordStrength,
  signUpSchema,
  profileSchema,
  addressSchema,
} from "@/schemas/auth";
import { safeNext } from "@/lib/safe-next";
import { DEMO, resetDb } from "@/server/mock/db";
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

describe("mock authentication", () => {
  it("signs in the demo customer and gives the same message for a wrong email or password", async () => {
    const ok = await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer");
    expect(ok.ok).toBe(true);
    const wrongPassword = await mockAuth.signIn(DEMO.customer.email, "nope", "customer");
    const wrongEmail = await mockAuth.signIn("nobody@example.test", "nope", "customer");
    expect(wrongPassword).toEqual(wrongEmail);
  });

  it("A-11 refuses suspended accounts with a specific message", async () => {
    const result = await mockAuth.signIn("uche.demo@example.test", "Sample-Pass1!", "customer");
    expect(result.ok).toBe(false);
  });

  it("locks an address after five failures", async () => {
    for (let i = 0; i < 5; i += 1) await mockAuth.signIn(DEMO.customer.email, "bad", "customer");
    const locked = await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer");
    expect(!locked.ok && locked.message).toMatch(/Too many attempts/);
  });

  it("A-14 keeps the two audiences apart and refuses a customer at the staff door", async () => {
    const customer = await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer");
    if (!customer.ok) throw new Error("sign-in failed");
    expect(await mockAuth.userForToken(customer.value.token, "customer")).not.toBeNull();
    expect(await mockAuth.userForToken(customer.value.token, "staff")).toBeNull();
    const denied = await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "staff");
    expect(!denied.ok && denied.message).toMatch(/Access denied/);
    const staff = await mockAuth.signIn(DEMO.owner.email, DEMO.owner.password, "staff");
    expect(staff.ok && staff.value.role).toBe("owner");
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
    expect((await mockAuth.signUp(input)).ok).toBe(false);
  });

  it("a reset link works once, changes the password and ends open sessions", async () => {
    const session = await mockAuth.signIn(DEMO.customer.email, DEMO.customer.password, "customer");
    if (!session.ok) throw new Error("sign-in failed");
    const { devToken } = await mockAuth.requestPasswordReset(DEMO.customer.email, "customer");
    if (!devToken) throw new Error("no token");
    expect((await mockAuth.resetPassword(devToken, "Brand-New1!")).ok).toBe(true);
    expect((await mockAuth.resetPassword(devToken, "Another-One1!")).ok).toBe(false);
    expect(await mockAuth.userForToken(session.value.token, "customer")).toBeNull();
    expect((await mockAuth.signIn(DEMO.customer.email, "Brand-New1!", "customer")).ok).toBe(true);
  });

  it("an unknown email gets no token and no error (M-23)", async () => {
    expect(await mockAuth.requestPasswordReset("nobody@example.test", "customer")).toEqual({
      devToken: null,
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
