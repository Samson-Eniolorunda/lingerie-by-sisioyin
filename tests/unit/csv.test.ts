import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('Lace, "balconette"')).toBe('"Lace, ""balconette"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("neutralises spreadsheet formulas in text but leaves numbers alone", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell(-5)).toBe("-5");
  });
  it("writes a header and rows with CRLF line ends", () => {
    expect(toCsv(["a", "b"], [[1, null]])).toBe("a,b\r\n1,\r\n");
  });
});
