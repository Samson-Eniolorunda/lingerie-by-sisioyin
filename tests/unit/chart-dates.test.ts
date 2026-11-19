import { describe, expect, it } from "vitest";
import { shortDate } from "@/features/admin/Charts";

describe("chart axis dates", () => {
  it("shows day and month name", () => {
    expect(shortDate("2026-10-21")).toBe("21 Oct");
    expect(shortDate("2026-01-05")).toBe("5 Jan");
  });
  it("leaves anything else as it came", () => {
    expect(shortDate("soon")).toBe("soon");
  });
});
