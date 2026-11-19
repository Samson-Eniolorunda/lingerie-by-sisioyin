import { describe, expect, it } from "vitest";
import { normaliseNigerianPhone } from "@/lib/phone";
import { formatOrderNumber, ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import {
  contactSchema,
  deliverySchema,
  orderInputSchema,
  receiptProblem,
  trackSchema,
} from "@/schemas/checkout";

describe("phone numbers (12.5)", () => {
  it("accepts 0XXXXXXXXXX and +234XXXXXXXXXX and stores the international form", () => {
    expect(normaliseNigerianPhone("08012345678")).toBe("+2348012345678");
    expect(normaliseNigerianPhone("+234 801 234 5678")).toBe("+2348012345678");
    expect(normaliseNigerianPhone("2349033344860")).toBe("+2349033344860");
  });
  it("refuses numbers that are not Nigerian", () => {
    expect(normaliseNigerianPhone("12345")).toBeNull();
    expect(normaliseNigerianPhone("+447911123456")).toBeNull();
    expect(normaliseNigerianPhone("0601234567")).toBeNull();
  });
});

describe("order numbers (K-14)", () => {
  it("formats LBS-DDMMYYYY-NNNN", () => {
    const n = formatOrderNumber(new Date(Date.UTC(2026, 10, 18, 12)), 7);
    expect(n).toBe("LBS-18112026-0007");
    expect(ORDER_NUMBER_PATTERN.test(n)).toBe(true);
  });
});

describe("checkout schemas", () => {
  it("reports each problem in plain words", () => {
    const r = contactSchema.safeParse({
      firstName: "",
      lastName: "A",
      email: "nope",
      phone: "123",
    });
    expect(r.success).toBe(false);
    const messages = r.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Enter your first name.");
    expect(messages.some((m) => m.includes("valid email"))).toBe(true);
    expect(messages.some((m) => m.includes("Nigerian number"))).toBe(true);
  });
  it("delivery state must come from the fee table (STR-09)", () => {
    expect(
      deliverySchema.safeParse({ address: "12 Allen Avenue", city: "Ikeja", state: "Kano" })
        .success,
    ).toBe(false);
    expect(
      deliverySchema.safeParse({ address: "12 Allen Avenue", city: "Ikeja", state: "Lagos" })
        .success,
    ).toBe(true);
  });
  it("K-11 payment confirmation must be ticked", () => {
    const base = {
      contact: { firstName: "A", lastName: "B", email: "a@b.co", phone: "08012345678" },
      delivery: { address: "12 Allen Avenue", city: "Ikeja", state: "Lagos" },
      lines: [{ id: "x", selectedSize: "S", selectedColor: "", qty: 1 }],
      quotedTotal: 1000,
      idempotencyKey: "abcdefgh-1234-5678",
      receiptPath: "abcdefgh-1234-5678/r.jpg",
    };
    expect(orderInputSchema.safeParse({ ...base, confirmedTransfer: false }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, confirmedTransfer: true }).success).toBe(true);
    expect(
      orderInputSchema.safeParse({ ...base, lines: [], confirmedTransfer: true }).success,
    ).toBe(false);
  });
  it("K-10 receipt limit is 4 MB and image or PDF only", () => {
    expect(receiptProblem({ size: 6 * 1024 * 1024, type: "image/png" })).toMatch(/4 MB/);
    expect(receiptProblem({ size: 1000, type: "text/html" })).toMatch(/photograph/);
    expect(receiptProblem({ size: 1000, type: "application/pdf" })).toBeNull();
  });
  it("T-03 tracking needs a well-formed order number and an email", () => {
    expect(trackSchema.safeParse({ order: "lbs-18112026-0001", email: "a@b.co" }).success).toBe(
      true,
    );
    expect(trackSchema.safeParse({ order: "123", email: "a@b.co" }).success).toBe(false);
  });
});
