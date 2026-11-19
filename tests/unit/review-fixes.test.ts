import { afterEach, describe, expect, it, vi } from "vitest";
import { allowRequest, allowShared, resetRateLimits } from "@/server/rate-limit";
import { callbackUrl, siteOrigin } from "@/server/auth/request";
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
  it("uses the preview's own address on a Vercel preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "lbs-git-branch-team.vercel.app");
    expect(siteOrigin()).toBe("https://lbs-git-branch-team.vercel.app");
    expect(callbackUrl("/reset-password")).toBe(
      "https://lbs-git-branch-team.vercel.app/auth/callback?next=%2Freset-password&aud=customer",
    );
  });

  it("uses NEXT_PUBLIC_SITE_URL elsewhere, and marks a sign-up confirmation link", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "ignored.vercel.app");
    expect(siteOrigin()).not.toContain("ignored");
    expect(callbackUrl("/dashboard", "customer", "confirm")).toContain("&type=confirm");
  });
});
