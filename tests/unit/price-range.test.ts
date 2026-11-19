import { describe, expect, it } from "vitest";
import { clampRange, parseBound } from "@/lib/price-range";

describe("price range (S-04)", () => {
  it("keeps both ends inside 0 and the ceiling", () => {
    expect(clampRange({ min: -5, max: 900_000 }, "max", 500_000)).toEqual({ min: 0, max: 500_000 });
  });
  it("the end being dragged wins when the ends cross", () => {
    expect(clampRange({ min: 300_000, max: 200_000 }, "min", 500_000)).toEqual({
      min: 300_000,
      max: 300_000,
    });
    expect(clampRange({ min: 300_000, max: 200_000 }, "max", 500_000)).toEqual({
      min: 200_000,
      max: 200_000,
    });
  });
  it("blank text means no limit", () => {
    expect(parseBound("", 500_000)).toBe(500_000);
    expect(parseBound("12,500", 0)).toBe(12_500);
  });
});
