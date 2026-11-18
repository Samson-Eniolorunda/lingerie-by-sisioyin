import { describe, expect, it } from "vitest";
import { maxQuantity, sizeAvailable, stockNote } from "@/lib/stock";

const product = {
  qty: 20,
  sizes: [
    { name: "S", qty: 6 },
    { name: "M", qty: 0 },
  ],
  colours: [{ name: "Black", qty: 4 }, { name: "Nude" }],
  variantStock: [
    { size: "S", color: "Black", qty: 2 },
    { size: "S", color: "Nude", qty: 0 },
    { size: "M", color: "Black", qty: 0 },
  ],
};

describe("stock caps", () => {
  it("BUG-05 uses the variant first", () => {
    expect(maxQuantity(product, { size: "S", colour: "Black" })).toBe(2);
    expect(maxQuantity(product, { size: "S", colour: "Nude" })).toBe(0);
  });
  it("falls back to colour, then size, then the product", () => {
    expect(maxQuantity(product, { colour: "Black" })).toBe(4);
    expect(maxQuantity(product, { size: "S" })).toBe(6);
    expect(maxQuantity(product, {})).toBe(20);
    expect(maxQuantity(product, { colour: "Nude" })).toBe(20);
  });
  it("an out-of-stock size is unavailable", () => {
    expect(sizeAvailable(product, "S")).toBe(true);
    expect(sizeAvailable(product, "M")).toBe(false);
  });
  it("describes stock plainly", () => {
    expect(stockNote(0, "").kind).toBe("out");
    expect(stockNote(3, " in this size").text).toBe("Only 3 left in this size");
    expect(stockNote(30, "").kind).toBe("ok");
  });
});
