import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_PRODUCTS } from "@/data/fixtures";
import {
  findMockOrder,
  findPromo,
  placeMockOrder,
  resetMockStore,
  stockOf,
} from "@/server/mock/orders";
import type { OrderInput } from "@/schemas/checkout";

const bra = FIXTURE_PRODUCTS[0];
const brief = FIXTURE_PRODUCTS[1];
if (!bra || !brief) throw new Error("fixtures missing");

const base = (lines: OrderInput["lines"], extra: Partial<OrderInput> = {}): OrderInput => ({
  contact: { firstName: "Ada", lastName: "Obi", email: "Ada@Example.com", phone: "+2348012345678" },
  delivery: { address: "12 Allen Avenue", city: "Ikeja", state: "Ogun" },
  lines,
  confirmedTransfer: true,
  ...extra,
});

beforeEach(resetMockStore);

describe("placing an order (SC-02 behaviour)", () => {
  it("SEC-01 prices come from the catalogue, never from the browser", () => {
    const result = placeMockOrder(
      base([{ id: brief.id, selectedSize: "M", selectedColor: "Black", qty: 2 }]),
    );
    expect(result.ok && result.order.subtotal).toBe(brief.priceNgn * 2);
    expect(result.ok && result.order.delivery).toBe(2000);
    expect(result.ok && result.order.total).toBe(brief.priceNgn * 2 + 2000);
  });

  it("BUG-04 promo discount reaches the order and its use is counted", () => {
    const result = placeMockOrder(
      base([{ id: brief.id, selectedSize: "M", selectedColor: "Black", qty: 1 }], {
        promoCode: "welcome10",
      }),
    );
    expect(result.ok && result.order.discount).toBe(650);
    expect(result.ok && result.order.promoCode).toBe("WELCOME10");
    placeMockOrder(
      base([{ id: brief.id, selectedSize: "M", selectedColor: "Black", qty: 1 }], {
        promoCode: "ONEUSE",
      }),
    );
    expect(findPromo("ONEUSE")).toBeNull();
  });

  it("refuses an expired or unknown promo instead of ignoring it", () => {
    const r = placeMockOrder(
      base([{ id: brief.id, selectedSize: "M", selectedColor: "Black", qty: 1 }], {
        promoCode: "EXPIRED",
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("BUG-05 stock is reduced by an order and an oversell is refused", () => {
    const before = stockOf(bra.id) ?? 0;
    expect(
      placeMockOrder(base([{ id: bra.id, selectedSize: "34B", selectedColor: "Black", qty: 2 }]))
        .ok,
    ).toBe(true);
    expect(stockOf(bra.id)).toBe(before - 2);
    const tooMany = placeMockOrder(
      base([{ id: bra.id, selectedSize: "34B", selectedColor: "Black", qty: 5 }]),
    );
    expect(tooMany.ok).toBe(false);
    expect(!tooMany.ok && tooMany.message).toMatch(/Only 4 of Lace balconette bra/);
  });

  it("BUG-01 a refused order creates nothing, so the bag is not cleared", () => {
    const r = placeMockOrder(
      base([{ id: "missing", selectedSize: "S", selectedColor: "", qty: 1 }]),
    );
    expect(r.ok).toBe(false);
    expect(findMockOrder("LBS-18112026-0001", "ada@example.com")).toBeNull();
  });

  it("K-14 order numbers run in sequence", () => {
    const a = placeMockOrder(
      base([{ id: brief.id, selectedSize: "L", selectedColor: "Nude", qty: 1 }]),
      new Date(Date.UTC(2026, 10, 18)),
    );
    const b = placeMockOrder(
      base([{ id: brief.id, selectedSize: "L", selectedColor: "Nude", qty: 1 }]),
      new Date(Date.UTC(2026, 10, 18)),
    );
    expect(a.ok && a.order.orderNumber).toBe("LBS-18112026-0001");
    expect(b.ok && b.order.orderNumber).toBe("LBS-18112026-0002");
  });

  it("T-03 guest tracking needs the order number and the same email; a wrong pair reveals nothing", () => {
    const r = placeMockOrder(
      base([{ id: brief.id, selectedSize: "L", selectedColor: "Nude", qty: 1 }]),
      new Date(Date.UTC(2026, 10, 18)),
    );
    const number = r.ok ? r.order.orderNumber : "";
    expect(findMockOrder(number, " ADA@example.com ")?.orderNumber).toBe(number);
    expect(findMockOrder(number, "someone@else.com")).toBeNull();
  });
});
