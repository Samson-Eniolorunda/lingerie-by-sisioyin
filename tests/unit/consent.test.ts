import { describe, expect, it } from "vitest";
import { analyticsAllowed, CONSENT_VERSION, makeConsent, parseConsent } from "@/lib/consent";

describe("consent gating", () => {
  it("analytics are off until an explicit yes", () => {
    expect(analyticsAllowed(null)).toBe(false);
    expect(analyticsAllowed(makeConsent("essential"))).toBe(false);
    expect(analyticsAllowed(makeConsent("all"))).toBe(true);
  });
  it("a corrupt or old record counts as no answer", () => {
    expect(parseConsent("yes")).toBeNull();
    expect(parseConsent({ choice: "all", version: 0, at: "x" })).toBeNull();
    expect(parseConsent({ choice: "maybe", version: CONSENT_VERSION, at: "x" })).toBeNull();
    expect(parseConsent(makeConsent("all"))?.choice).toBe("all");
  });
});
