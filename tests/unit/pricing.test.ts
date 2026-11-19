import { describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/pricing";
import { deliveryFeeFor } from "@/lib/delivery";
import { formatNaira } from "@/lib/money";

const lines = [
  { price_ngn: 15000, qty: 2 },
  { price_ngn: 8500, qty: 1 },
];

describe("totals", () => {
  it("adds lines and delivery", () => {
    expect(computeTotals(lines, { stateId: "Ogun" })).toEqual({
      subtotal: 38500,
      discount: 0,
      delivery: 2000,
      total: 40500,
    });
  });

  it("BUG-04 promo discount is part of the total and never touches delivery", () => {
    const totals = computeTotals(lines, { promoPercent: 10, stateId: "Oyo" });
    expect(totals.discount).toBe(3850);
    expect(totals.total).toBe(38500 - 3850 + 2500);
  });

  it("rounds the discount to whole naira", () => {
    expect(computeTotals([{ price_ngn: 999, qty: 1 }], { promoPercent: 15 }).discount).toBe(150);
  });

  it("clamps a promo percentage to 0 to 100", () => {
    expect(computeTotals(lines, { promoPercent: 250 }).total).toBe(0);
    expect(computeTotals(lines, { promoPercent: -5 }).discount).toBe(0);
  });

  it("Lagos is free and an unset state adds nothing", () => {
    expect(deliveryFeeFor("Lagos")).toBe(0);
    expect(computeTotals(lines).delivery).toBe(0);
    expect(deliveryFeeFor("Kano")).toBeNull();
  });

  it("formats naira without decimals", () => {
    expect(formatNaira(1250000)).toBe("₦1,250,000");
    expect(formatNaira(0)).toBe("₦0");
  });
});
