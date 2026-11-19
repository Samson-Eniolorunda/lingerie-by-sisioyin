import { describe, expect, it } from "vitest";
import { countOf } from "@/lib/plural";

describe("countOf", () => {
  it("uses the singular for exactly one", () => {
    expect(countOf(1, "item")).toBe("1 item");
  });
  it("uses the plural for zero and many", () => {
    expect(countOf(0, "item")).toBe("0 items");
    expect(countOf(3, "review")).toBe("3 reviews");
  });
  it("takes an irregular plural and groups thousands", () => {
    expect(countOf(2, "box", "boxes")).toBe("2 boxes");
    expect(countOf(1200, "result")).toBe("1,200 results");
  });
});
