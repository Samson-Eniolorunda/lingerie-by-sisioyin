import { describe, expect, it } from "vitest";
import { parseCatalogueParams, toSearchParams } from "@/schemas/catalogue";
import { applyQuery, matchesSearch } from "@/server/queries/catalogue";
import { FIXTURE_PRODUCTS } from "@/data/fixtures";

describe("shop URL parameters (R-18, S-11)", () => {
  it("reads filters, the legacy ?q= and ignores invalid values", () => {
    const { query, page } = parseCatalogueParams({
      category: "Lingerie",
      gender: "Nope",
      q: "lace",
      min: "abc",
      page: "2",
    });
    expect(query.category).toBe("Lingerie");
    expect(query.gender).toBeUndefined();
    expect(query.search).toBe("lace");
    expect(query.minPrice).toBeUndefined();
    expect(page).toBe(2);
  });
  it("round-trips a query without defaults", () => {
    const { query } = parseCatalogueParams({
      gender: "Men",
      is_new: "true",
      sort: "price-asc",
      stock: "1",
    });
    expect(toSearchParams(query).toString()).toBe("gender=Men&stock=1&is_new=true&sort=price-asc");
  });
});

describe("catalogue filtering (S-02 to S-08)", () => {
  it("filters by category, gender, price, stock and newness", () => {
    expect(
      applyQuery(FIXTURE_PRODUCTS, { category: "Loungewear" }).every(
        (p) => p.category === "Loungewear",
      ),
    ).toBe(true);
    expect(applyQuery(FIXTURE_PRODUCTS, { gender: "Kids" }).every((p) => p.gender === "Kids")).toBe(
      true,
    );
    expect(
      applyQuery(FIXTURE_PRODUCTS, { minPrice: 10000, maxPrice: 20000 }).every(
        (p) => p.priceNgn >= 10000 && p.priceNgn <= 20000,
      ),
    ).toBe(true);
    expect(applyQuery(FIXTURE_PRODUCTS, { inStockOnly: true }).every((p) => p.qty > 0)).toBe(true);
    expect(applyQuery(FIXTURE_PRODUCTS, { newOnly: true }).every((p) => p.isNew)).toBe(true);
  });
  it("sorts by price and name", () => {
    const asc = applyQuery(FIXTURE_PRODUCTS, { sort: "price-asc" }).map((p) => p.priceNgn);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const names = applyQuery(FIXTURE_PRODUCTS, { sort: "name" }).map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it("SEC-18 treats commas and brackets in a search as plain text", () => {
    expect(applyQuery(FIXTURE_PRODUCTS, { search: "a),is_active.eq.false,(b" })).toEqual([]);
    const lace = FIXTURE_PRODUCTS[0];
    expect(lace && matchesSearch(lace, "LACE")).toBe(true);
  });
});
