import { afterEach, describe, expect, it } from "vitest";
import {
  ATTEMPT_KEY,
  FORM_KEY,
  clearCheckoutStorage,
  saveContactAfterOrder,
  saveForm,
  startingValues,
} from "@/features/checkout/saved-form";
import { EMPTY_VALUES } from "@/features/checkout/validate";

function fakeStorage() {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  };
  return map;
}
afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

const account = {
  email: "me@example.test",
  firstName: "Me",
  lastName: "Owner",
  phone: "",
  address: "",
  city: "",
  state: "",
};
const guest = JSON.stringify({
  ...EMPTY_VALUES,
  firstName: "Guest",
  email: "guest@example.test",
  phone: "0801",
  address: "1 Guest Road",
  city: "Lagos",
});

describe("checkout form on the device", () => {
  it("never reads a guest's saved details for a signed-in account", () => {
    const v = startingValues(guest, "", account);
    expect(v).toMatchObject({ email: "me@example.test", firstName: "Me", phone: "", address: "" });
    expect(v.city).toBe("");
  });
  it("still restores a guest's saved form", () => {
    expect(startingValues(guest, "Ogun", null)).toMatchObject({
      firstName: "Guest",
      address: "1 Guest Road",
      state: "Ogun",
    });
  });
  it("does not store a signed-in account's values, but keeps a guest's", () => {
    const map = fakeStorage();
    saveForm({ ...EMPTY_VALUES, email: "me@example.test" }, true);
    saveContactAfterOrder({ ...EMPTY_VALUES, email: "me@example.test" }, true);
    expect(map.has(FORM_KEY)).toBe(false);
    saveForm({ ...EMPTY_VALUES, email: "guest@example.test" }, false);
    expect(map.get(FORM_KEY)).toContain("guest@example.test");
    saveContactAfterOrder({ ...EMPTY_VALUES, firstName: "Ada", address: "kept out" }, false);
    expect(map.get(FORM_KEY)).toContain("Ada");
    expect(map.get(FORM_KEY)).not.toContain("kept out");
  });
  it("sign-out clears the form and the attempt key", () => {
    const map = fakeStorage();
    map.set(FORM_KEY, guest);
    map.set(ATTEMPT_KEY, "x");
    map.set("LBS_CART_V1", "[]");
    clearCheckoutStorage();
    expect([...map.keys()]).toEqual(["LBS_CART_V1"]);
  });
});
