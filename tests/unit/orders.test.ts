import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_PRODUCTS } from "@/data/fixtures";
import { endOfLagosDay } from "@/lib/dates";
import { formatOrderNumber, ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import { getDb } from "@/server/mock/db";
import { mockAdmin } from "@/server/mock/admin";
import { mockOrders, resetMockStore, stockOf } from "@/server/mock/orders";
import { orderInput, placeTest } from "./helpers";
import type { SessionUser } from "@/types/account";

const bra = FIXTURE_PRODUCTS[0];
const brief = FIXTURE_PRODUCTS[1];
if (!bra || !brief) throw new Error("fixtures missing");

const line = (qty = 1, size = "M", colour = "Black", id = brief.id) => [
  { id, selectedSize: size, selectedColor: colour, qty },
];

const owner = (): SessionUser => {
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

function stockOfVariant(productId: string, size: string, colour: string): number {
  const p = getDb().products.find((x) => x.id === productId);
  return p?.variantStock.find((v) => v.size === size && v.color === colour)?.qty ?? -1;
}

beforeEach(resetMockStore);

describe("placing an order (SC-02 behaviour)", () => {
  it("SEC-01 prices come from the catalogue, never from the browser", async () => {
    const result = await placeTest(line(2));
    expect(result.ok && result.order.subtotal).toBe(brief.priceNgn * 2);
    expect(result.ok && result.order.delivery).toBe(2000);
    expect(result.ok && result.order.total).toBe(brief.priceNgn * 2 + 2000);
  });

  it("BUG-04 promo discount reaches the order and its use is counted", async () => {
    const result = await placeTest(line(), { promoCode: "welcome10" });
    expect(result.ok && result.order.discount).toBe(650);
    expect(result.ok && result.order.promoCode).toBe("WELCOME10");
    await placeTest(line(), { promoCode: "ONEUSE" });
    expect((await mockOrders.validatePromo("ONEUSE")).ok).toBe(false);
  });

  it("refuses an expired or unknown promo instead of ignoring it", async () => {
    expect((await placeTest(line(), { promoCode: "EXPIRED" })).ok).toBe(false);
  });

  it("a promo expiring on a Lagos date is valid until 23:59 there, then not", async () => {
    expect(endOfLagosDay("2026-11-19")).toBe("2026-11-19T22:59:59.000Z");
    getDb().promos.push({
      id: "p-x",
      code: "TODAY",
      percent: 10,
      active: true,
      expiresAt: endOfLagosDay("2026-11-19"),
      usageLimit: null,
      usedCount: 0,
      createdAt: "2026-11-01T00:00:00.000Z",
    });
    const evening = new Date("2026-11-19T22:30:00.000Z");
    const after = new Date("2026-11-19T23:00:00.000Z");
    expect((await mockOrders.validatePromo("TODAY", evening)).ok).toBe(true);
    expect((await mockOrders.validatePromo("TODAY", after)).ok).toBe(false);
  });

  it("BUG-05 stock is reduced by an order and an oversell is refused", async () => {
    const before = stockOf(bra.id) ?? 0;
    expect((await placeTest(line(2, "34B", "Black", bra.id))).ok).toBe(true);
    expect(stockOf(bra.id)).toBe(before - 2);
    const tooMany = await placeTest(line(5, "34B", "Black", bra.id));
    expect(tooMany.ok).toBe(false);
    expect(!tooMany.ok && tooMany.message).toMatch(/Only 4 of Lace balconette bra/);
  });

  it("decrements exactly the variant that was ordered, not another size or colour", async () => {
    const other = stockOfVariant(brief.id, "L", "Nude");
    const exact = stockOfVariant(brief.id, "M", "Black");
    await placeTest(line(2));
    expect(stockOfVariant(brief.id, "M", "Black")).toBe(exact - 2);
    expect(stockOfVariant(brief.id, "L", "Nude")).toBe(other);
  });

  it("requires an exact size, and a colour when the product has colours", async () => {
    const noColour = await placeTest(line(1, "M", ""));
    expect(!noColour.ok && noColour.message).toMatch(/Choose a colour/);
    const noSize = await placeTest(line(1, "", "Black"));
    expect(!noSize.ok && noSize.message).toMatch(/Choose a size/);
    const nonsense = await placeTest(line(1, "M", "Purple"));
    expect(!nonsense.ok && nonsense.message).toMatch(/not sold in that size and colour/);
  });

  it("does not let one variant's stock cover another: two lines for one variant share its stock", async () => {
    const left = stockOfVariant(bra.id, "34B", "Black");
    const lines = [
      { id: bra.id, selectedSize: "34B", selectedColor: "Black", qty: left },
      { id: bra.id, selectedSize: "34B", selectedColor: "Black", qty: 1 },
    ];
    expect((await placeTest(lines)).ok).toBe(false);
    expect(stockOfVariant(bra.id, "34B", "Black")).toBe(left);
  });

  it("refuses a product that is switched off or in the trash", async () => {
    const index = getDb().products.findIndex((p) => p.id === brief.id);
    const current = getDb().products[index];
    if (!current) throw new Error("seed");
    getDb().products[index] = { ...current, active: false };
    const hidden = await placeTest(line());
    expect(!hidden.ok && hidden.message).toMatch(/no longer sold/);
    getDb().products[index] = { ...current, deletedAt: "2026-11-01T00:00:00.000Z" };
    expect((await placeTest(line())).ok).toBe(false);
  });

  it("BUG-01 a refused order creates nothing, so the bag is not cleared", async () => {
    const r = await placeTest([{ id: "missing", selectedSize: "S", selectedColor: "", qty: 1 }]);
    expect(r.ok).toBe(false);
    expect(getDb().orders.size).toBe(
      [...getDb().orders.values()].filter((o) => o.idempotencyKey.startsWith("seed-")).length,
    );
  });

  it("rejects an order whose quoted total no longer matches, and says what the total is now", async () => {
    const result = await placeTest(line(), { quotedTotal: 1 });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.changedTotal).toBe(brief.priceNgn + 2000);
  });

  it("the same idempotency key places one order, however many times it is sent", async () => {
    const key = "idem-key-0000000001";
    const first = await placeTest(line(), { idempotencyKey: key });
    const before = stockOfVariant(brief.id, "M", "Black");
    const second = await placeTest(line(), { idempotencyKey: key });
    expect(first.ok && second.ok && second.order.orderNumber).toBe(
      first.ok ? first.order.orderNumber : "",
    );
    expect(stockOfVariant(brief.id, "M", "Black")).toBe(before);
  });

  it("refuses an order whose receipt never reached storage, or belongs to another key", async () => {
    const input = orderInput(line(), { quotedTotal: brief.priceNgn + 2000 });
    const missing = await mockOrders.place(input, { userId: null });
    expect(!missing.ok && missing.message).toMatch(/did not finish uploading/);
    const stray = await mockOrders.place(
      { ...input, receiptPath: "someone-elses-key-0001/receipt.jpg" },
      { userId: null },
    );
    expect(!stray.ok && stray.message).toMatch(/could not be matched/);
  });

  it("K-14 order numbers run in sequence, use the Lagos date and may pass four digits", async () => {
    const day = new Date("2026-11-18T23:30:00.000Z"); // 00:30 on the 19th in Lagos
    const a = await placeTest(line(), {}, { now: day });
    const b = await placeTest(line(1, "L", "Nude"), {}, { now: day });
    expect(a.ok && a.order.orderNumber).toBe("LBS-19112026-0001");
    expect(b.ok && b.order.orderNumber).toBe("LBS-19112026-0002");
    const big = formatOrderNumber(day, 12345);
    expect(big).toBe("LBS-19112026-12345");
    expect(ORDER_NUMBER_PATTERN.test(big)).toBe(true);
  });

  it("T-03 guest tracking needs the order number and the same email; a wrong pair reveals nothing", async () => {
    const r = await placeTest(line(1, "L", "Nude"));
    const number = r.ok ? r.order.orderNumber : "";
    expect((await mockOrders.lookup(number, " ADA@example.com "))?.orderNumber).toBe(number);
    expect(await mockOrders.lookup(number, "someone@else.com")).toBeNull();
  });
});

describe("payment states", () => {
  it("confirmation happens only through the payment decision, not the status", async () => {
    const placed = await placeTest(line());
    if (!placed.ok) throw new Error(placed.message);
    const n = placed.order.orderNumber;
    const viaStatus = await mockAdmin.setOrderStatus(n, "confirmed", owner());
    expect(viaStatus.ok).toBe(false);
    expect((await mockAdmin.setPaymentDecision(n, "confirmed", owner())).ok).toBe(true);
    expect(await mockOrders.byNumber(n)).toMatchObject({
      status: "confirmed",
      paymentStatus: "confirmed",
    });
    expect((await mockAdmin.setPaymentDecision(n, "rejected", owner())).ok).toBe(false);
  });

  it("a rejected receipt sets a re-upload deadline; a new receipt puts it back in the queue", async () => {
    const placed = await placeTest(line());
    if (!placed.ok) throw new Error(placed.message);
    const n = placed.order.orderNumber;
    await mockAdmin.setPaymentDecision(n, "rejected", owner());
    const rejected = await mockOrders.byNumber(n);
    expect(rejected).toMatchObject({ status: "pending", paymentStatus: "rejected" });
    expect(rejected?.receiptReuploadUntil).not.toBeNull();
    const path = `${placed.order.idempotencyKey}/second.jpg`;
    expect((await mockOrders.attachReceipt(n, path)).ok).toBe(false);
    const { saveMockReceipt } = await import("@/server/storage/receipts");
    saveMockReceipt(path, { type: "image/jpeg", size: 10 });
    expect((await mockOrders.attachReceipt(n, path)).ok).toBe(true);
    expect(await mockOrders.byNumber(n)).toMatchObject({
      paymentStatus: "awaiting_confirmation",
      receiptPath: path,
      receiptReuploadUntil: null,
    });
  });

  it("an unreplaced rejected receipt cancels the order after the deadline and releases the stock", async () => {
    const before = stockOfVariant(brief.id, "M", "Black");
    const placed = await placeTest(line(2));
    if (!placed.ok) throw new Error(placed.message);
    const n = placed.order.orderNumber;
    await mockAdmin.setPaymentDecision(n, "rejected", owner());
    expect(await mockOrders.expireUnpaid(new Date())).toBe(0);
    const later = new Date(Date.now() + 49 * 3_600_000);
    expect(await mockOrders.expireUnpaid(later)).toBe(1);
    expect((await mockOrders.byNumber(n))?.status).toBe("cancelled");
    expect(stockOfVariant(brief.id, "M", "Black")).toBe(before);
    expect(await mockOrders.expireUnpaid(later)).toBe(0);
  });

  it("cancelling a paid order records a refund owed; cancelling twice restores stock once", async () => {
    const before = stockOfVariant(brief.id, "M", "Black");
    const placed = await placeTest(line(2));
    if (!placed.ok) throw new Error(placed.message);
    const n = placed.order.orderNumber;
    await mockAdmin.setPaymentDecision(n, "confirmed", owner());
    expect((await mockAdmin.setOrderStatus(n, "cancelled", owner())).ok).toBe(true);
    expect(await mockOrders.byNumber(n)).toMatchObject({
      status: "cancelled",
      paymentStatus: "refund_owed",
    });
    expect((await mockAdmin.setOrderStatus(n, "cancelled", owner())).ok).toBe(false);
    expect(stockOfVariant(brief.id, "M", "Black")).toBe(before);
  });

  it("cancelling gives the promo use back", async () => {
    const placed = await placeTest(line(), { promoCode: "ONEUSE" });
    if (!placed.ok) throw new Error(placed.message);
    expect((await mockOrders.validatePromo("ONEUSE")).ok).toBe(false);
    await mockAdmin.setOrderStatus(placed.order.orderNumber, "cancelled", owner());
    expect((await mockOrders.validatePromo("ONEUSE")).ok).toBe(true);
  });
});

describe("the quote", () => {
  it("gives the same figures the order will carry and refuses an unknown variant", async () => {
    const quote = await mockOrders.quote({ lines: line(2), state: "Ogun", promoCode: "WELCOME10" });
    const placed = await placeTest(line(2), { promoCode: "WELCOME10" });
    expect(quote.ok && placed.ok && quote.total).toBe(placed.ok ? placed.order.total : -1);
    expect((await mockOrders.quote({ lines: line(1, "M", "Purple"), state: "Ogun" })).ok).toBe(
      false,
    );
  });
});
