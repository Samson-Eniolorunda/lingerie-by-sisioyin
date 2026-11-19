import { beforeEach, describe, expect, it } from "vitest";
import { visibleNav } from "@/features/admin/nav";
import { fillBankDetails } from "@/lib/bank-details";
import { can } from "@/lib/permissions";
import {
  customerStatusSchema,
  messageMarkSchema,
  orderStatusSchema,
  paymentDecisionSchema,
  productDraftSchema,
  promoSchema,
  settingsSchema,
  bankDetailsSchema,
  staffRoleSchema,
} from "@/schemas/admin";
import { mockAdmin } from "@/server/mock/admin";
import { DEMO, getDb, resetDb } from "@/server/mock/db";
import type { SessionUser } from "@/types/account";

function actor(email: string): SessionUser {
  const user = [...getDb().users.values()].find((u) => u.profile.email === email);
  if (!user) throw new Error("seed");
  return {
    id: user.profile.id,
    email,
    firstName: user.profile.firstName,
    lastName: user.profile.lastName,
    role: user.role,
  };
}

const ALL = { limit: 1000, offset: 0 };

const draft = {
  name: "Test bra",
  category: "Lingerie" as const,
  priceNgn: 12000,
  gender: "Women" as const,
  description: "",
  deliveryType: "standard" as const,
  isNew: true,
  active: true,
  allowColourSelection: true,
  packType: "Single",
  variants: [{ size: "M", color: "Black", qty: 4 }],
  images: [],
};

beforeEach(() => {
  resetDb();
});

describe("admin permissions and navigation", () => {
  it("M-10 an editor sees products, orders and messages only", () => {
    const labels = visibleNav("editor").map((i) => i.label);
    expect(labels).toEqual([
      "Dashboard",
      "Orders",
      "Products",
      "Messages",
      "Reviews",
      "Receipts with no order",
    ]);
    expect(visibleNav("owner").length).toBe(12);
    expect(can("editor", "roles.manage")).toBe(false);
    expect(can("super_admin", "roles.manage")).toBe(true);
  });
});

describe("product rules (MI-13 to MI-19)", () => {
  it("accepts a valid draft and derives stock from the variants", async () => {
    expect(productDraftSchema.safeParse(draft).success).toBe(true);
    const created = await mockAdmin.createProduct(draft, actor(DEMO.owner.email));
    expect(created.ok && created.value.qty).toBe(4);
    expect(created.ok && created.value.slug).toBe("test-bra");
  });
  it("refuses a missing name, a negative stock, no variants and a colourless line", () => {
    const bad = productDraftSchema.safeParse({
      ...draft,
      name: "",
      variants: [{ size: "M", color: "", qty: -1 }],
    });
    expect(bad.success).toBe(false);
    expect(productDraftSchema.safeParse({ ...draft, variants: [] }).success).toBe(false);
    expect(
      productDraftSchema.safeParse({ ...draft, variants: [{ size: "M", color: "", qty: 1 }] })
        .success,
    ).toBe(false);
    expect(productDraftSchema.safeParse({ ...draft, priceNgn: 50 }).success).toBe(false);
  });
  it("an assorted pack keeps no colours and no variant lines", async () => {
    const pack = await mockAdmin.createProduct(
      {
        ...draft,
        allowColourSelection: false,
        packType: "3-in-1",
        variants: [{ size: "M", color: "", qty: 9 }],
      },
      actor(DEMO.owner.email),
    );
    expect(pack.ok && pack.value.variantStock).toEqual([]);
    expect(pack.ok && pack.value.qty).toBe(9);
  });
  it("MX-09 trash, restore, permanent delete and empty trash", async () => {
    const owner = actor(DEMO.owner.email);
    const made = await mockAdmin.createProduct(draft, owner);
    if (!made.ok) throw new Error("create");
    expect((await mockAdmin.deleteProductForever(made.value.id, owner)).ok).toBe(false);
    await mockAdmin.trashProduct(made.value.id, owner);
    expect((await mockAdmin.product(made.value.id))?.deletedAt).not.toBeNull();
    await mockAdmin.restoreProduct(made.value.id, owner);
    expect((await mockAdmin.product(made.value.id))?.deletedAt).toBeNull();
    await mockAdmin.trashProduct(made.value.id, owner);
    const emptied = await mockAdmin.emptyTrash(owner);
    expect(emptied.ok && emptied.value.removed).toBe(1);
    expect(await mockAdmin.product(made.value.id)).toBeNull();
  });
});

describe("order workflow (MO-04, MO-08)", () => {
  it("moves a pending order through every step and refuses a skipped one", async () => {
    const owner = actor(DEMO.owner.email);
    const pending = [...getDb().orders.values()].find((o) => o.status === "pending");
    if (!pending) throw new Error("seed");
    const n = pending.orderNumber;
    expect((await mockAdmin.setOrderStatus(n, "shipped", owner)).ok).toBe(false);
    expect((await mockAdmin.setPaymentDecision(n, "confirmed", owner)).ok).toBe(true);
    for (const s of ["processing", "shipped", "delivered"] as const)
      expect((await mockAdmin.setOrderStatus(n, s, owner)).ok).toBe(true);
    expect((await mockAdmin.setOrderStatus(n, "cancelled", owner)).ok).toBe(false);
  });
  it("rejecting a receipt keeps the order pending and logs it", async () => {
    const owner = actor(DEMO.owner.email);
    const pending = [...getDb().orders.values()].find((o) => o.status === "pending");
    if (!pending) throw new Error("seed");
    await mockAdmin.setPaymentDecision(pending.orderNumber, "rejected", owner);
    const after = await mockAdmin.order(pending.orderNumber);
    expect(after).toMatchObject({ status: "pending", paymentStatus: "rejected" });
    expect((await mockAdmin.activity("", { limit: 5, offset: 0 })).items[0]?.action).toBe(
      "receipt rejected",
    );
  });
});

describe("customers, promos, staff", () => {
  it("MC-03 suspending a customer signs them out; MC-12 deletion removes the profile and keeps orders", async () => {
    const owner = actor(DEMO.owner.email);
    const customer = (await mockAdmin.customers("", ALL)).items.find((c) => c.orderCount > 0);
    if (!customer) throw new Error("seed");
    expect((await mockAdmin.setCustomerStatus(customer.id, "suspended", owner)).ok).toBe(true);
    const orders = (await mockAdmin.orders({}, ALL)).items.filter(
      (o) => o.email === customer.email,
    ).length;
    expect((await mockAdmin.deleteCustomer(customer.id, owner)).ok).toBe(true);
    expect((await mockAdmin.customers("", ALL)).items.some((c) => c.id === customer.id)).toBe(
      false,
    );
    expect(
      (await mockAdmin.orders({}, ALL)).items.filter((o) => o.email === customer.email).length,
    ).toBe(orders);
  });
  it("promo codes are upper-cased, unique and validated", async () => {
    expect(
      promoSchema.safeParse({ code: "bad code", percent: 10, expiresAt: "", usageLimit: null })
        .success,
    ).toBe(false);
    expect(
      promoSchema.safeParse({ code: "x1", percent: 10, expiresAt: "", usageLimit: null }).success,
    ).toBe(false);
    const ok = promoSchema.safeParse({
      code: "spring15",
      percent: 15,
      expiresAt: "",
      usageLimit: null,
    });
    expect(ok.success && ok.data.code).toBe("SPRING15");
    expect(
      promoSchema.safeParse({ code: "SPRING15", percent: 95, expiresAt: "", usageLimit: null })
        .success,
    ).toBe(false);
    const owner = actor(DEMO.owner.email);
    expect(
      (
        await mockAdmin.savePromo(
          { code: "SPRING15", percent: 15, expiresAt: null, usageLimit: null },
          owner,
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await mockAdmin.savePromo(
          { code: "SPRING15", percent: 5, expiresAt: null, usageLimit: null },
          owner,
        )
      ).ok,
    ).toBe(false);
  });
  it("MX-12 owner and developer are protected; nobody changes their own role", async () => {
    const owner = actor(DEMO.owner.email);
    const editor = actor(DEMO.editor.email);
    expect((await mockAdmin.setStaffRole(owner.id, "editor", editor)).ok).toBe(false);
    expect((await mockAdmin.removeStaff(owner.id, owner)).ok).toBe(false);
    expect((await mockAdmin.setStaffRole(editor.id, "super_admin", owner)).ok).toBe(true);
    expect((await mockAdmin.setStaffRole(editor.id, "editor", actor(DEMO.editor.email))).ok).toBe(
      false,
    );
  });
  it("settings are validated", () => {
    const base = {
      announcement: "",
      whatsappNumber: "2349033344860",
      supportEmail: "a@b.co",
      lowStockThreshold: 5,
      notifyNewOrders: true,
    };
    expect(settingsSchema.safeParse(base).success).toBe(true);
    expect(settingsSchema.safeParse({ ...base, supportEmail: "nope" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, whatsappNumber: "+234 90" }).success).toBe(false);
  });
});

describe("bank details", () => {
  const base = {
    bankName: "Access Bank",
    accountNumber: "0123456789",
    accountName: "Sisioyin Stores",
    note: "",
  };
  it("accepts a listed bank, a ten digit number and a name", () => {
    expect(bankDetailsSchema.safeParse(base).success).toBe(true);
  });
  it("refuses an unlisted bank, a short or lettered number, and a missing name", () => {
    expect(bankDetailsSchema.safeParse({ ...base, bankName: "Made Up Bank" }).success).toBe(false);
    expect(bankDetailsSchema.safeParse({ ...base, accountNumber: "123" }).success).toBe(false);
    expect(bankDetailsSchema.safeParse({ ...base, accountNumber: "01234abcde" }).success).toBe(
      false,
    );
    expect(bankDetailsSchema.safeParse({ ...base, accountName: "" }).success).toBe(false);
  });
  it("fills legal text from what was saved, or says the details are being updated", () => {
    const text = ["Pay to ({{bank.summary}}) at {{bank.name}}."];
    expect(fillBankDetails(text, base)[0]).toBe(
      "Pay to (Access Bank, Account Number: 0123456789, Account Name: Sisioyin Stores) at Access Bank.",
    );
    expect(fillBankDetails(text, null)[0]).toContain("Payment details are being updated");
  });
});

describe("lists, enums and the activity log", () => {
  it("pages every list and reports the total", async () => {
    const page = await mockAdmin.orders({}, { limit: 5, offset: 0 });
    expect(page.items).toHaveLength(5);
    expect(page.total).toBeGreaterThan(5);
    const counts = await mockAdmin.orderCounts();
    expect(Object.values(counts).reduce((n, c) => n + c, 0)).toBe(page.total);
    expect((await mockAdmin.messages({ status: "unread" }, ALL)).items.length).toBe(
      (await mockAdmin.messageCounts()).unread,
    );
  });

  it("customer totals come from one pass over the orders and match the order list", async () => {
    const customers = (await mockAdmin.customers("", ALL)).items;
    const orders = (await mockAdmin.orders({}, ALL)).items;
    const demo = customers.find((c) => c.email === DEMO.customer.email);
    expect(demo?.orderCount).toBe(orders.filter((o) => o.userId === demo?.id).length);
    expect((await mockAdmin.customerStats(new Date(0))).total).toBe(customers.length);
  });

  it("the activity log keeps more than 200 entries and logs marking a message", async () => {
    const owner = actor(DEMO.owner.email);
    const id = getDb().messages[0]?.id ?? "";
    for (let i = 0; i < 230; i += 1)
      await mockAdmin.markMessage(id, i % 2 ? "read" : "unread", owner);
    const log = await mockAdmin.activity("", { limit: 10, offset: 0 });
    expect(log.total).toBe(230);
    expect(log.items[0]?.action).toMatch(/message marked/);
  });

  it("role, customer status, payment decision and order status are checked as enums", () => {
    expect(staffRoleSchema.safeParse("owner").success).toBe(false);
    expect(staffRoleSchema.safeParse("editor").success).toBe(true);
    expect(customerStatusSchema.safeParse("deleted").success).toBe(false);
    expect(paymentDecisionSchema.safeParse("refunded").success).toBe(false);
    expect(orderStatusSchema.safeParse("teleported").success).toBe(false);
    expect(orderStatusSchema.safeParse("shipped").success).toBe(true);
    expect(messageMarkSchema.safeParse("replied").success).toBe(false);
  });

  it("an editor cannot manage promo codes", () => {
    expect(can("editor", "promos.manage")).toBe(false);
    expect(can("super_admin", "promos.manage")).toBe(true);
  });

  it("a promo expiry date ends at 23:59 Lagos time", () => {
    const parsed = promoSchema.safeParse({
      code: "XMAS",
      percent: 10,
      expiresAt: "2026-12-25",
      usageLimit: null,
    });
    expect(parsed.success && parsed.data.expiresAt).toBe("2026-12-25T22:59:59.000Z");
  });
});
