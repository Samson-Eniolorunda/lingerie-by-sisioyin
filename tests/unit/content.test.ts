import { describe, expect, it } from "vitest";
import { FAQ_GROUPS, PRIVACY, TERMS } from "@/content";
import type { ContentNode } from "@/content/schema";
import { SIZE_CHARTS } from "@/data/size-charts";
import { DELIVERY_STATES } from "@/lib/delivery";

const text = (nodes: readonly ContentNode[]): string =>
  nodes.map((n) => (typeof n === "string" ? n : text(n.c))).join(" ");

describe("P-11 FAQ content", () => {
  it("keeps 23 questions in six groups with the original counts", () => {
    expect(FAQ_GROUPS.map((g) => [g.title, g.items.length])).toEqual([
      ["Orders", 4],
      ["Shipping", 5],
      ["Returns & Exchanges", 4],
      ["Payment", 3],
      ["Sizing", 3],
      ["Account", 4],
    ]);
  });
  it("BUG-31 states the 30-minute cancellation window the code enforces", () => {
    const all = FAQ_GROUPS.flatMap((g) => g.items.map((i) => text(i.a))).join(" ");
    expect(all).toContain("within 30 minutes of placing them");
    expect(all).not.toContain("within 1 hour of placing");
  });
});

describe("P-09, P-10, P-19, P-21 legal content", () => {
  it("privacy has nine sections including data deletion", () => {
    expect(PRIVACY.sections).toHaveLength(9);
    expect(PRIVACY.sections.map((s) => s.id)).toContain("data-deletion");
  });
  it("terms has the ten sections in order", () => {
    expect(TERMS.sections.map((s) => s.title)).toEqual([
      "Acceptance of Terms",
      "Eligibility",
      "Account Registration",
      "Orders & Payment",
      "Shipping & Delivery",
      "Returns & Refunds",
      "Intellectual Property",
      "Prohibited Activities",
      "Limitation of Liability",
      "Contact Us",
    ]);
  });
  it("terms quote the delivery fee for every state the checkout offers (P-13)", () => {
    const shipping = text(TERMS.sections.find((s) => s.id === "shipping")?.body ?? []);
    for (const state of DELIVERY_STATES.filter((s) => s.feeNgn > 0)) {
      expect(shipping, state.label).toContain(state.feeNgn.toLocaleString("en-NG"));
    }
  });
});

describe("P-16 size chart data", () => {
  it("keeps every row of every chart", () => {
    const rows = Object.fromEntries(SIZE_CHARTS.map((c) => [c.id, c.rows.length]));
    expect(rows).toEqual({ bras: 8, panties: 6, bodysuits: 5, loungewear: 6 });
    for (const chart of SIZE_CHARTS)
      for (const row of chart.rows) expect(row).toHaveLength(chart.columns.length);
  });
});
