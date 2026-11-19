import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_PRODUCTS } from "@/data/fixtures";
import {
  canCancelByCustomer,
  canRequestReturn,
  canTransition,
  cancelDeadline,
  timelineStep,
} from "@/lib/order-rules";
import { mockAccount } from "@/server/mock/account";
import { DEMO, getDb, resetDb } from "@/server/mock/db";
import { stockOf } from "@/server/mock/orders";
import { placeTest } from "./helpers";

const demoId = () => {
  const user = [...getDb().users.values()].find((u) => u.profile.email === DEMO.customer.email);
  if (!user) throw new Error("demo user missing");
  return user.profile.id;
};

const bra = FIXTURE_PRODUCTS[1];
if (!bra) throw new Error("fixture missing");

const lines = [{ id: bra.id, selectedSize: "M", selectedColor: "Black", qty: 2 }];
const all = { limit: 200, offset: 0 };

beforeEach(resetDb);

describe("order rules", () => {
  const base = {
    status: "pending",
    createdAt: "2026-11-18T10:00:00.000Z",
    updatedAt: "2026-11-18T10:00:00.000Z",
  } as const;

  it("D-06 allows cancelling only while pending and inside 30 minutes", () => {
    expect(canCancelByCustomer(base, new Date("2026-11-18T10:29:00.000Z"))).toBe(true);
    expect(canCancelByCustomer(base, new Date("2026-11-18T10:30:01.000Z"))).toBe(false);
    expect(
      canCancelByCustomer({ ...base, status: "confirmed" }, new Date("2026-11-18T10:05:00.000Z")),
    ).toBe(false);
    expect(cancelDeadline(base).toISOString()).toBe("2026-11-18T10:30:00.000Z");
  });

  it("D-07 offers a return for seven days after delivery", () => {
    const delivered = {
      ...base,
      status: "delivered",
      updatedAt: "2026-11-10T10:00:00.000Z",
    } as const;
    expect(canRequestReturn(delivered, new Date("2026-11-17T09:00:00.000Z"))).toBe(true);
    expect(canRequestReturn(delivered, new Date("2026-11-18T09:00:00.000Z"))).toBe(false);
    expect(canRequestReturn(base, new Date("2026-11-18T10:05:00.000Z"))).toBe(false);
  });

  it("moves forward one step at a time and never out of a final status", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("delivered", "pending")).toBe(false);
    expect(timelineStep("shipped")).toBe(3);
  });
});

describe("account repository", () => {
  it("lists only the signed-in customer's orders, newest first, and hides others", async () => {
    const { items: orders } = await mockAccount.orders(demoId(), {}, all);
    expect(orders.length).toBeGreaterThanOrEqual(4);
    expect(orders.every((o) => o.userId === demoId())).toBe(true);
    const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    expect(orders).toEqual(sorted);
    const foreign = [...getDb().orders.values()].find((o) => o.email !== DEMO.customer.email);
    if (!foreign) throw new Error("no foreign order");
    expect(await mockAccount.order(demoId(), foreign.orderNumber)).toBeNull();
  });

  it("D-06 cancels a fresh pending order and puts the stock back", async () => {
    const before = stockOf(bra.id);
    const placed = await placeTest(lines, {}, { userId: demoId(), email: DEMO.customer.email });
    if (!placed.ok) throw new Error(placed.message);
    expect(stockOf(bra.id)).toBe((before ?? 0) - 2);
    const result = await mockAccount.cancelOrder(demoId(), placed.order.orderNumber);
    expect(result.ok).toBe(true);
    expect(stockOf(bra.id)).toBe(before);
    expect((await mockAccount.order(demoId(), placed.order.orderNumber))?.status).toBe("cancelled");
  });

  it("refuses to cancel an order already being processed or somebody else's", async () => {
    const processing = (await mockAccount.orders(demoId(), {}, all)).items.find(
      (o) => o.status === "processing",
    );
    if (!processing) throw new Error("no processing order");
    expect((await mockAccount.cancelOrder(demoId(), processing.orderNumber)).ok).toBe(false);
    const foreign = [...getDb().orders.values()].find((o) => o.email !== DEMO.customer.email);
    if (!foreign) throw new Error("no foreign order");
    expect((await mockAccount.cancelOrder(demoId(), foreign.orderNumber)).ok).toBe(false);
  });

  it("D-08 keeps one default address and at most five", async () => {
    const input = (n: number, isDefault: boolean) => ({
      label: `Place ${n}`,
      recipient: "Demo Customer",
      phone: "08012345678",
      line1: `${n} Allen Avenue`,
      city: "Ikeja",
      state: "Lagos",
      isDefault,
    });
    await mockAccount.saveAddress(demoId(), input(1, false));
    await mockAccount.saveAddress(demoId(), input(2, true));
    const list = await mockAccount.addresses(demoId());
    expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    expect(list[0]?.label).toBe("Place 2");
    for (let n = 3; n <= 5; n += 1) await mockAccount.saveAddress(demoId(), input(n, false));
    expect((await mockAccount.saveAddress(demoId(), input(6, false))).ok).toBe(false);
    const first = list[1];
    if (!first) throw new Error("missing");
    await mockAccount.deleteAddress(demoId(), list[0]?.id ?? "");
    expect((await mockAccount.addresses(demoId())).some((a) => a.isDefault)).toBe(true);
  });

  it("D-09 saves the profile with the phone normalised", async () => {
    const result = await mockAccount.updateProfile(demoId(), {
      firstName: "Demo",
      lastName: "Customer",
      phone: "08012345678",
      dateOfBirth: "1995-04-02",
      gender: "female",
    });
    expect(result.ok && result.value.phone).toBe("+2348012345678");
  });

  it("D-17 needs the password and marks the profile for deletion", async () => {
    expect((await mockAccount.requestDeletion(demoId(), "wrong")).ok).toBe(false);
    expect((await mockAccount.requestDeletion(demoId(), DEMO.customer.password)).ok).toBe(true);
    expect((await mockAccount.profile(demoId()))?.deletionRequestedAt).not.toBeNull();
    await mockAccount.withdrawDeletion(demoId());
    expect((await mockAccount.profile(demoId()))?.deletionRequestedAt).toBeNull();
  });

  it("D-15 exports profile, addresses and orders as text", async () => {
    const text = await mockAccount.exportData(demoId());
    expect(text).toContain(DEMO.customer.email);
    expect(text).toContain("Orders");
  });
});

describe("order ownership and paging", () => {
  it("a guest order is attached to an account by its user id, or by a verified email only", async () => {
    const guest = await placeTest(lines, {}, { userId: null, email: DEMO.customer.email });
    if (!guest.ok) throw new Error(guest.message);
    const n = guest.order.orderNumber;
    expect((await mockAccount.order(demoId(), n))?.orderNumber).toBe(n);
    const record = getDb().users.get(demoId());
    if (!record) throw new Error("seed");
    record.emailVerified = false;
    expect(await mockAccount.order(demoId(), n)).toBeNull();
    expect(
      (await mockAccount.orders(demoId(), {}, all)).items.some((o) => o.orderNumber === n),
    ).toBe(false);
  });

  it("lists in pages with a total", async () => {
    const first = await mockAccount.orders(demoId(), {}, { limit: 2, offset: 0 });
    const rest = await mockAccount.orders(demoId(), {}, { limit: 2, offset: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.total).toBeGreaterThanOrEqual(4);
    expect(rest.items[0]?.orderNumber).not.toBe(first.items[0]?.orderNumber);
    expect(
      (await mockAccount.orders(demoId(), { status: "delivered" }, all)).items.every(
        (o) => o.status === "delivered",
      ),
    ).toBe(true);
  });
});
