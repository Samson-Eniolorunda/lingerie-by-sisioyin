import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowRequest, allowShared, resetRateLimits } from "@/server/rate-limit";
import { callbackUrl, hostAllowed, siteOrigin } from "@/server/auth/request";
import { trackedOrder, type StoredOrder } from "@/types/orders";

afterEach(() => {
  resetRateLimits();
  vi.unstubAllEnvs();
});

const order: StoredOrder = {
  orderNumber: "LBS-01012026-0001",
  userId: "user-1",
  email: "ada@example.com",
  phone: "+2348012345678",
  customerName: "Ada Obi",
  address: "12 Marina Road",
  city: "Ikeja",
  state: "Lagos",
  landmark: "Opposite the bank",
  lines: [],
  subtotal: 1000,
  discount: 0,
  delivery: 0,
  total: 1000,
  promoCode: null,
  status: "pending",
  paymentStatus: "awaiting_confirmation",
  receiptPath: "key/receipt.jpg",
  receiptReuploadUntil: null,
  idempotencyKey: "key-key-key-key-key",
  notes: "Leave with the guard",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("review fix 4: the tracking page sees only what it needs", () => {
  it("drops the phone number, street address, name, account, notes, receipt and key", () => {
    const tracked = trackedOrder(order) as Record<string, unknown>;
    for (const secret of [
      "phone",
      "address",
      "customerName",
      "userId",
      "notes",
      "receiptPath",
      "idempotencyKey",
      "email",
      "landmark",
    ])
      expect(tracked).not.toHaveProperty(secret);
    expect(tracked).toMatchObject({ orderNumber: order.orderNumber, city: "Ikeja", total: 1000 });
  });
});

describe("review fix 8: rate limits", () => {
  beforeEach(() => {
    vi.stubEnv("LBS_ALLOW_DEMO", "");
  });

  it("limits by address and by subject, and counts each separately", async () => {
    const limits = { ip: 3, subject: 2, windowMs: 60_000 };
    expect(await allowRequest("t", "1.1.1.1", ["a@x.test"], limits)).toBe(true);
    expect(await allowRequest("t", "1.1.1.2", ["a@x.test"], limits)).toBe(true);
    expect(await allowRequest("t", "1.1.1.3", ["a@x.test"], limits)).toBe(false); // the e-mail is used up
    expect(await allowRequest("t", "1.1.1.1", ["b@x.test"], limits)).toBe(true);
  });

  it("falls back to the per-instance limiter without a database", async () => {
    expect(await allowShared("k:1", 1, 1000)).toBe(true);
    expect(await allowShared("k:1", 1, 1000)).toBe(false);
  });
});

describe("review fix 6: links in e-mails return to the deployment that sent them", () => {
  it("uses the preview's own address on a Vercel preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "lbs-git-branch-team.vercel.app");
    expect(siteOrigin()).toBe("https://lbs-git-branch-team.vercel.app");
    expect(await callbackUrl("/reset-password")).toBe(
      "https://lbs-git-branch-team.vercel.app/auth/callback?next=%2Freset-password&aud=customer",
    );
  });

  it("uses NEXT_PUBLIC_SITE_URL elsewhere, and marks a sign-up confirmation link", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "ignored.vercel.app");
    expect(siteOrigin()).not.toContain("ignored");
    expect(await callbackUrl("/dashboard", "customer", "confirm")).toContain("&type=confirm");
  });
});

describe("auth links on a preview follow the request's own host, checked against an allow-list", () => {
  it("accepts the production domain, this deployment's two Vercel addresses and, when developing, localhost", () => {
    vi.stubEnv("VERCEL_URL", "lbs-abc123-team.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "lbs-git-rebuild-production-team.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_NAME", "lingerie-by-sisioyin");
    vi.stubEnv("VERCEL_GIT_REPO_SLUG", "lingerie-by-sisioyin");
    for (const ok of [
      "www.lingeriebysisioyin.store",
      "lbs-abc123-team.vercel.app",
      "lbs-git-rebuild-production-team.vercel.app",
      "localhost:3000",
    ])
      expect(hostAllowed(ok), ok).toBe(true);
    for (const bad of [
      "evil.example",
      "someone-elses-project.vercel.app",
      // A name that merely starts with the project's name is not enough.
      "lingerie-by-sisioyin-git-evil-team.vercel.app",
      "www.lingeriebysisioyin.store.evil.example",
      "lingerie-by-sisioyin.evil.example",
      "",
    ])
      expect(hostAllowed(bad), bad).toBe(false);
  });
});

describe("review fix 2 in the development store: cancelling with an unaccepted receipt opens a refund check", () => {
  it("flags it, and a confirmed payment owes a refund instead", async () => {
    const { applyCancellation } = await import("@/server/mock/orders");
    const { getDb, resetDb } = await import("@/server/mock/db");
    resetDb();
    const db = getDb();
    const waiting = { ...order, orderNumber: "LBS-W", lines: [] };
    db.orders.set("LBS-W", waiting);
    expect(applyCancellation(db, waiting, new Date())?.paymentStatus).toBe("refund_check");
    const paid = { ...order, orderNumber: "LBS-P", lines: [], paymentStatus: "confirmed" as const };
    db.orders.set("LBS-P", paid);
    expect(applyCancellation(db, paid, new Date())).toMatchObject({
      paymentStatus: "refund_owed",
      refundAmount: 1000,
    });
    const noReceipt = { ...order, orderNumber: "LBS-N", lines: [], receiptPath: null };
    db.orders.set("LBS-N", noReceipt);
    expect(applyCancellation(db, noReceipt, new Date())?.paymentStatus).toBe(
      "awaiting_confirmation",
    );
  });
});
