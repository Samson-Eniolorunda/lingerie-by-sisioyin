import { describe, expect, it } from "vitest";
import { calculateBraSize } from "@/lib/bra-size";

describe("bra size calculator", () => {
  it("matches the live bands and cups", () => {
    expect(calculateBraSize(70, 82)).toMatchObject({ ok: true, label: "32B" });
    expect(calculateBraSize(75, 98)).toMatchObject({ ok: true, label: "34E" });
    expect(calculateBraSize(66, 76)).toMatchObject({ ok: true, label: "30A" });
  });
  it("BUG-32 flags sizes the printed chart does not list", () => {
    expect(calculateBraSize(66, 76)).toMatchObject({ inChart: false });
    expect(calculateBraSize(80, 97)).toMatchObject({ label: "36D", inChart: false });
    expect(calculateBraSize(80, 92)).toMatchObject({ label: "36B", inChart: true });
    expect(calculateBraSize(80, 100)).toMatchObject({ label: "36DD", inChart: false });
  });
  it("explains invalid input in the result, not an alert", () => {
    expect(calculateBraSize(Number.NaN, 90)).toMatchObject({ ok: false });
    expect(calculateBraSize(20, 90)).toMatchObject({ ok: false });
    expect(calculateBraSize(80, 70)).toMatchObject({
      ok: false,
      message: expect.stringContaining("smaller"),
    });
  });
});
