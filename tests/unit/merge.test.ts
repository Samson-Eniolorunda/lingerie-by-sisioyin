import { describe, expect, it } from "vitest";
import { mergeCart, mergeWishlist, variantIdFor } from "@/lib/cart-merge";
import type { CartLine } from "@/types/domain";

const line = (variantId: string, qty: number): CartLine => ({
  variantId,
  id: variantId.split("-")[0] ?? "",
  name: "Item",
  price_ngn: 1000,
  selectedSize: "S",
  selectedColor: "",
  image: "",
  qty,
});

describe("merge rules", () => {
  it("wishlist is a duplicate-free union", () => {
    expect(mergeWishlist(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
  it("bag keeps local lines and adds only missing remote variants", () => {
    const merged = mergeCart([line("a-S", 2)], [line("a-S", 9), line("b-M", 1)]);
    expect(merged.map((l) => [l.variantId, l.qty])).toEqual([
      ["a-S", 2],
      ["b-M", 1],
    ]);
  });
  it("builds the variant id the live site writes", () => {
    expect(variantIdFor("p1", "S", "Black")).toBe("p1-S-Black");
    expect(variantIdFor("p1", undefined, undefined)).toBe("p1-default");
  });
});
