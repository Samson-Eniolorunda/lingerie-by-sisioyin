import { describe, expect, it } from "vitest";
import { EMPTY_VALUES, validateContact, validateDelivery } from "@/features/checkout/validate";

describe("checkout step validation (12.5, A11Y-04)", () => {
  it("gives one message per invalid field, keyed by the field", () => {
    const errors = validateContact({ ...EMPTY_VALUES, email: "bad", phone: "1" });
    expect(Object.keys(errors).sort()).toEqual(["email", "firstName", "lastName", "phone"]);
  });
  it("passes a complete contact step", () => {
    expect(
      validateContact({
        ...EMPTY_VALUES,
        firstName: "A",
        lastName: "B",
        email: "a@b.co",
        phone: "08012345678",
      }),
    ).toEqual({});
  });
  it("requires a state from the fee table and a street address", () => {
    const errors = validateDelivery({ ...EMPTY_VALUES, address: "1", city: "I", state: "" });
    expect(Object.keys(errors).sort()).toEqual(["address", "city", "state"]);
    expect(
      validateDelivery({
        ...EMPTY_VALUES,
        address: "12 Allen Avenue",
        city: "Ikeja",
        state: "Lagos",
      }),
    ).toEqual({});
  });
});
