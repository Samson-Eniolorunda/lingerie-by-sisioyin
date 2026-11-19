import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_PRODUCTS } from "@/data/fixtures";
import { getDb } from "@/server/mock/db";
import { mockAdmin } from "@/server/mock/admin";
import { resetMockStore } from "@/server/mock/orders";
import type { SessionUser } from "@/types/account";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
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

describe("a refund check that finds more money than the order total", () => {
  async function openCheck() {
    const { placeTest } = await import("./helpers");
    const placed = await placeTest(lines);
    if (!placed.ok) throw new Error("order not placed");
    const order = {
      ...placed.order,
      status: "cancelled" as const,
      paymentStatus: "refund_check" as const,
    };
    getDb().orders.set(order.orderNumber, order);
    return order;
  }

  it("must be confirmed by staff, and is then owed in full", async () => {
    const order = await openCheck();
    const refused = await mockAdmin.resolveRefundCheck(order.orderNumber, order.total + 1, staff());
    expect(refused.ok).toBe(false);
    expect(getDb().orders.get(order.orderNumber)?.paymentStatus).toBe("refund_check");
    const accepted = await mockAdmin.resolveRefundCheck(
      order.orderNumber,
      order.total + 1,
      staff(),
      true,
    );
    expect(accepted.ok).toBe(true);
    expect(getDb().orders.get(order.orderNumber)).toMatchObject({
      paymentStatus: "refund_owed",
      refundAmount: order.total + 1,
    });
  });

  it("refuses an amount the refund column cannot hold", async () => {
    const { receivedAmountSchema } = await import("@/schemas/admin");
    expect(receivedAmountSchema.safeParse(99_999_999).success).toBe(true);
    expect(receivedAmountSchema.safeParse(100_000_000).success).toBe(false);
  });
});
