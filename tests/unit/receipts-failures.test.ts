import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_PRODUCTS } from "@/data/fixtures";
import { getDb } from "@/server/mock/db";
import { mockAdmin } from "@/server/mock/admin";
import { mockOrders, resetMockStore } from "@/server/mock/orders";
import { saveMockReceipt } from "@/server/storage/receipts";
import type { SessionUser } from "@/types/account";
import { orderInput } from "./helpers";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-vercel-forwarded-for": "198.51.100.7" }),
  cookies: async () => ({ set: () => undefined, get: () => undefined }),
}));
vi.mock("next/server", () => ({ after: () => undefined, NextResponse: {} }));

const brief = FIXTURE_PRODUCTS[1];
if (!brief) throw new Error("fixtures missing");
const lines = [{ id: brief.id, selectedSize: "M", selectedColor: "Black", qty: 1 }];

const staff = (): SessionUser => {
  const user = [...getDb().users.values()].find((u) => u.role === "owner");
  if (!user) throw new Error("seed");
  return {
    id: user.profile.id,
    email: user.profile.email,
    firstName: "O",
    lastName: "W",
    role: "owner",
  };
};

beforeEach(resetMockStore);
afterEach(() => vi.unstubAllEnvs());

async function uploaded(email = "ada@example.com") {
  const input = orderInput(lines, { quotedTotal: 1 }, email);
  saveMockReceipt(input.receiptPath, { type: "image/jpeg", size: 1000 });
  await mockOrders.recordUpload({
    idempotencyKey: input.idempotencyKey,
    path: input.receiptPath,
    name: "Ada Obi",
    email,
    phone: "+2348012345678",
    quotedTotal: 1,
  });
  return input;
}

describe("a receipt is never lost after the upload", () => {
  it("shows an upload that never became an order, with the customer's contact details", async () => {
    const input = await uploaded("Ada@Example.com");
    const rows = await mockAdmin.orphanReceipts();
    const row = rows.find((r) => r.path === input.receiptPath);
    expect(row).toMatchObject({
      customerName: "Ada Obi",
      email: "ada@example.com",
      phone: "+2348012345678",
      failureId: null,
      viewed: false,
    });
  });

  it("records a failure when the order rate limit stops the order", async () => {
    vi.stubEnv("LBS_ALLOW_DEMO", "false");
    const { placeOrder } = await import("@/server/actions/orders");
    const input = await uploaded("limit@example.com");
    // Use up the e-mail's allowance of five orders in the hour.
    const { allowShared } = await import("@/server/rate-limit");
    for (let i = 0; i < 5; i++) await allowShared("order:id:limit@example.com", 5, 3_600_000);
    const result = await placeOrder({ ...input, quotedTotal: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("we have your receipt");
    const row = (await mockAdmin.orphanReceipts()).find((r) => r.path === input.receiptPath);
    expect(row?.failureId).not.toBeNull();
    expect(row?.email).toBe("limit@example.com");
  });

  it("records a failure when there are no bank details to pay into", async () => {
    const { placeOrder } = await import("@/server/actions/orders");
    getDb().bank = null;
    const input = await uploaded("bank@example.com");
    const result = await placeOrder({ ...input, quotedTotal: 1 });
    expect(result.ok).toBe(false);
    const row = (await mockAdmin.orphanReceipts()).find((r) => r.path === input.receiptPath);
    expect(row?.failureId).not.toBeNull();
    expect(row?.reason).toContain("Bank details");
  });
});

describe("deleting a receipt", () => {
  it("is refused until a member of staff has opened it, then allowed and logged", async () => {
    const input = await uploaded();
    const actor = staff();
    const refused = await mockAdmin.deleteOrphanReceipt(input.receiptPath, actor);
    expect(refused.ok).toBe(false);
    await mockAdmin.markReceiptViewed(input.receiptPath, actor);
    expect((await mockAdmin.deleteOrphanReceipt(input.receiptPath, actor)).ok).toBe(true);
    expect(getDb().activity.some((a) => JSON.stringify(a).includes("receipt deleted"))).toBe(true);
  });

  it("is refused for an open failure even after it was opened", async () => {
    const input = await uploaded("open@example.com");
    await mockOrders.recordFailure({ ...input, quotedTotal: 1 }, "Out of stock");
    const actor = staff();
    await mockAdmin.markReceiptViewed(input.receiptPath, actor);
    expect((await mockAdmin.deleteOrphanReceipt(input.receiptPath, actor)).ok).toBe(false);
  });
});

describe("the caller's address behind Vercel", () => {
  it("prefers Vercel's own header over a caller-supplied x-forwarded-for", async () => {
    const { clientIp } = await import("@/server/auth/request");
    expect(await clientIp()).toBe("198.51.100.7");
  });
});
