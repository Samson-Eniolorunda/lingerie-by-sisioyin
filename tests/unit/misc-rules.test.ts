import { describe, expect, it } from "vitest";
import { jsonLd } from "@/lib/json-ld";
import { allow, resetRateLimits } from "@/server/rate-limit";
import { collectAll } from "@/server/paging";
import { lookupVariant } from "@/lib/variants";
import { orderInputSchema } from "@/schemas/checkout";
import { receiptProblem } from "@/lib/receipt-types";

describe("JSON-LD", () => {
  it("escapes < so a product name cannot close the script tag", () => {
    const text = jsonLd({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});

describe("rate limit and paging helpers", () => {
  it("allows a few calls, then refuses until the window passes", () => {
    resetRateLimits();
    expect(allow("k", 2, 1000, 0)).toBe(true);
    expect(allow("k", 2, 1000, 1)).toBe(true);
    expect(allow("k", 2, 1000, 2)).toBe(false);
    expect(allow("k", 2, 1000, 1500)).toBe(true);
  });
  it("collects every page", async () => {
    const rows = Array.from({ length: 450 }, (_, i) => i);
    const all = await collectAll(async ({ limit, offset }) => ({
      items: rows.slice(offset, offset + limit),
      total: rows.length,
    }));
    expect(all).toHaveLength(450);
  });
});

describe("exact variants", () => {
  const withColours = {
    qty: 5,
    sizes: [{ name: "M" }],
    colours: [{ name: "Black" }],
    variantStock: [{ size: "M", color: "Black", qty: 3 }],
  };
  it("needs size and colour together and never falls back to the product total", () => {
    expect(lookupVariant(withColours, "M", "Black")).toMatchObject({ ok: true, available: 3 });
    expect(lookupVariant(withColours, "M", "")).toMatchObject({ ok: false, reason: "colour" });
    expect(lookupVariant(withColours, "", "Black")).toMatchObject({ ok: false, reason: "size" });
    expect(lookupVariant(withColours, "L", "Black")).toMatchObject({
      ok: false,
      reason: "variant",
    });
  });
  it("a product sold by size takes the size's stock; one without sizes is sold as it is", () => {
    const bySize = { qty: 9, sizes: [{ name: "S", qty: 2 }], colours: [], variantStock: [] };
    expect(lookupVariant(bySize, "S", "")).toMatchObject({ ok: true, available: 2 });
    expect(lookupVariant(bySize, "XL", "")).toMatchObject({ ok: false });
    expect(
      lookupVariant({ qty: 4, sizes: [], colours: [], variantStock: [] }, "", ""),
    ).toMatchObject({
      ok: true,
      available: 4,
    });
  });
});

describe("order input", () => {
  const base = {
    contact: { firstName: "A", lastName: "B", email: "a@b.co", phone: "08012345678" },
    delivery: { address: "12 Allen Avenue", city: "Ikeja", state: "Lagos" },
    lines: [{ id: "x", selectedSize: "M", selectedColor: "Black", qty: 1 }],
    confirmedTransfer: true,
    quotedTotal: 1000,
    idempotencyKey: "abcdefgh-1234-5678",
    receiptPath: "abcdefgh-1234-5678/r.jpg",
  };
  it("needs the quoted total, a client key and the uploaded receipt's path", () => {
    expect(orderInputSchema.safeParse(base).success).toBe(true);
    expect(orderInputSchema.safeParse({ ...base, quotedTotal: undefined }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, idempotencyKey: "short" }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, receiptPath: "" }).success).toBe(false);
  });
  it("gives a clear message for each receipt problem", () => {
    expect(receiptProblem({ type: "image/webp", size: 1000 })).toBeNull();
    expect(receiptProblem({ type: "image/gif", size: 1000 })).toMatch(/JPG, PNG or WebP/);
  });
});
