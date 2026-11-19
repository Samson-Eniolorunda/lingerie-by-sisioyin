import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { resetFailureCounters } from "@/server/auth/throttle";
import type { ProductDraft } from "@/server/data/contracts";
import { supabaseAccount } from "@/server/supabase/account";
import { supabaseAdmin } from "@/server/supabase/admin";
import { supabaseAuth } from "@/server/supabase/auth";
import { supabaseCatalogue } from "@/server/supabase/catalogue";
import { supabaseContact } from "@/server/supabase/contact";
import { supabaseOrders } from "@/server/supabase/orders";
import { receipts } from "@/server/storage/receipts";
import {
  EDITOR,
  OWNER,
  admin,
  clearBrowser,
  createCustomer,
  orderInput,
  page,
  signInAs,
  stockedProduct,
  uniqueEmail,
  uploadedReceipt,
} from "./helpers";
import type { SessionUser } from "@/types/account";

let owner: SessionUser;
let editor: SessionUser;

async function asOwner() {
  clearBrowser();
  owner = await signInAs(OWNER.email, OWNER.password, "staff");
}
async function asEditor() {
  clearBrowser();
  editor = await signInAs(EDITOR.email, EDITOR.password, "staff");
}

beforeEach(() => {
  clearBrowser();
  resetFailureCounters();
});

const draft = (name: string, over: Partial<ProductDraft> = {}): ProductDraft => ({
  name,
  category: "Lingerie",
  gender: "Women",
  priceNgn: 12000,
  description: "A test product.",
  deliveryType: "standard",
  isNew: false,
  active: true,
  allowColourSelection: true,
  packType: "Single",
  variants: [
    { size: "S", color: "Black", qty: 3 },
    { size: "M", color: "Black", qty: 4 },
    { size: "M", color: "Nude", qty: 2 },
  ],
  images: [{ src: "/placeholders/product-1.svg", alt: name }],
  ...over,
});

async function placedOrder(email = uniqueEmail("buyer")) {
  const placed = await supabaseOrders.place(await orderInput({ email }), { userId: null });
  if (!placed.ok) throw new Error(placed.message);
  return placed.order;
}

describe("access", () => {
  it("lets no one without a staff session read or change anything", async () => {
    await expect(supabaseAdmin.customers("", page())).rejects.toThrow();
    await expect(supabaseAdmin.orderCounts()).rejects.toThrow();
    await expect(supabaseAdmin.promos(page())).rejects.toThrow(); // no grant at all for a visitor
    expect((await supabaseAdmin.products({}, page())).items.length).toBeGreaterThan(0); // the public catalogue only
    const fake = {
      id: randomUUID(),
      email: "x@example.test",
      firstName: "X",
      lastName: "Y",
      role: "owner",
    } as SessionUser;
    expect((await supabaseAdmin.createProduct(draft("Sneaky"), fake)).ok).toBe(false);
    expect((await supabaseAdmin.setCustomerStatus(randomUUID(), "banned", fake)).ok).toBe(false);
  });

  it("limits an editor to products, orders and messages", async () => {
    await asEditor();
    expect((await supabaseAdmin.products({}, page())).total).toBeGreaterThan(0);
    expect((await supabaseAdmin.orders({}, page())).total).toBeGreaterThan(0);
    await expect(supabaseAdmin.customers("", page())).rejects.toThrow();
    await expect(supabaseAdmin.analytics(7)).rejects.toThrow();
    expect((await supabaseAdmin.promos(page())).items).toHaveLength(0);
    expect(
      (
        await supabaseAdmin.savePromo(
          { code: "EDITORS", percent: 5, expiresAt: null, usageLimit: null },
          editor,
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await supabaseAdmin.saveSettings(
          { ...(await supabaseAdmin.settings()), announcement: "x" },
          editor,
        )
      ).ok,
    ).toBe(false);
    expect((await supabaseAdmin.inviteStaff("someone@example.test", "editor", editor)).ok).toBe(
      false,
    );
  });
});

describe("products", () => {
  it("creates, edits, trashes, restores and deletes for good, with a log line each time", async () => {
    await asOwner();
    const created = await supabaseAdmin.createProduct(draft("Test balconette bra"), owner);
    if (!created.ok) throw new Error(created.message);
    const product = created.value;
    expect(product.slug).toBe("test-balconette-bra");
    expect(product.qty).toBe(9);
    expect(product.variantStock).toHaveLength(3);
    expect(
      (await supabaseAdmin.createProduct(draft("Test balconette bra"), owner)).ok && true,
    ).toBe(true);
    const second = await supabaseAdmin.products({ search: "test balconette" }, page());
    expect(second.items.map((p) => p.slug).sort()).toEqual([
      "test-balconette-bra",
      "test-balconette-bra-2",
    ]);
    expect((await supabaseCatalogue.bySlug(product.slug))?.id).toBe(product.id);

    const edited = await supabaseAdmin.updateProduct(
      product.id,
      draft("Test balconette bra", {
        priceNgn: 15000,
        variants: [{ size: "M", color: "Black", qty: 1 }],
        active: false,
        stockVersion: product.stockVersion,
      }),
      owner,
    );
    expect(edited.ok && edited.value).toMatchObject({ priceNgn: 15000, qty: 1, active: false });
    expect(await supabaseCatalogue.bySlug(product.slug)).toBeNull(); // hidden
    expect(
      (await supabaseAdmin.updateProduct(randomUUID(), draft("Ghost", { stockVersion: 0 }), owner))
        .ok,
    ).toBe(false);

    expect((await supabaseAdmin.deleteProductForever(product.id, owner)).ok).toBe(false); // not in the trash yet
    expect((await supabaseAdmin.trashProduct(product.id, owner)).ok).toBe(true);
    expect(
      (await supabaseAdmin.products({ trash: true }, page())).items.some(
        (p) => p.id === product.id,
      ),
    ).toBe(true);
    expect((await supabaseAdmin.product(product.id))?.deletedAt).not.toBeNull();
    expect((await supabaseAdmin.restoreProduct(product.id, owner)).ok).toBe(true);
    expect((await supabaseAdmin.product(product.id))?.deletedAt).toBeNull();
    await supabaseAdmin.trashProduct(product.id, owner);
    expect((await supabaseAdmin.deleteProductForever(product.id, owner)).ok).toBe(true);
    expect(await supabaseAdmin.product(product.id)).toBeNull();
    const counts = await supabaseAdmin.productCounts();
    expect(counts.live).toBeGreaterThan(10);
    const trashed = await supabaseAdmin.emptyTrash(owner);
    expect(trashed.ok).toBe(true);
    const activity = await supabaseAdmin.activity("balconette", page());
    expect(activity.items.map((a) => a.action)).toEqual(
      expect.arrayContaining(["create", "update", "delete", "restore", "permanent delete"]),
    );
    expect(activity.items[0]).toMatchObject({ actor: "Demo Owner", role: "owner" });
  });

  it("filters by stock and category", async () => {
    await asEditor();
    const out = await supabaseAdmin.products({ stock: "out" }, page());
    expect(out.items.every((p) => p.qty === 0)).toBe(true);
    const lounge = await supabaseAdmin.products({ category: "Loungewear" }, page());
    expect(lounge.items.every((p) => p.category === "Loungewear")).toBe(true);
    expect(lounge.total).toBeGreaterThan(0);
  });
});

describe("orders", () => {
  it("confirms a payment, moves the order on, and refuses steps out of order", async () => {
    const order = await placedOrder();
    await asOwner();
    expect((await supabaseAdmin.order(order.orderNumber))?.receiptPath).toBe(order.receiptPath);
    const link = await receipts.link(order.receiptPath as string);
    expect(link.url).toContain("/object/sign/");
    expect((await supabaseAdmin.setOrderStatus(order.orderNumber, "confirmed", owner)).ok).toBe(
      false,
    ); // only through the payment decision
    expect((await supabaseAdmin.setOrderStatus(order.orderNumber, "shipped", owner)).ok).toBe(
      false,
    );
    expect((await supabaseAdmin.setPaymentDecision(order.orderNumber, "confirmed", owner)).ok).toBe(
      true,
    );
    expect((await supabaseAdmin.setPaymentDecision(order.orderNumber, "confirmed", owner)).ok).toBe(
      false,
    );
    const confirmed = await supabaseAdmin.order(order.orderNumber);
    expect(confirmed).toMatchObject({ status: "confirmed", paymentStatus: "confirmed" });
    for (const next of ["processing", "shipped", "delivered"] as const)
      expect((await supabaseAdmin.setOrderStatus(order.orderNumber, next, owner)).ok).toBe(true);
    expect((await supabaseAdmin.setOrderStatus(order.orderNumber, "cancelled", owner)).ok).toBe(
      false,
    );
    const counts = await supabaseAdmin.orderCounts();
    expect(counts.delivered).toBeGreaterThan(0);
    expect(
      (await supabaseAdmin.orders({ status: "delivered", search: order.orderNumber }, page()))
        .total,
    ).toBe(1);
    expect((await supabaseAdmin.orders({ search: order.email }, page())).total).toBe(1);
    expect((await supabaseAdmin.setOrderStatus("LBS-01012000-0000", "processing", owner)).ok).toBe(
      false,
    );
  });

  it("rejects a receipt, lets the customer send another, and cancels it when time runs out", async () => {
    const order = await placedOrder();
    await asOwner();
    expect((await supabaseAdmin.setPaymentDecision(order.orderNumber, "rejected", owner)).ok).toBe(
      true,
    );
    const rejected = await supabaseAdmin.order(order.orderNumber);
    expect(rejected).toMatchObject({ status: "pending", paymentStatus: "rejected" });
    expect(rejected?.receiptReuploadUntil).not.toBeNull();
    // The guest sends another receipt: the server does it for them.
    const wrongScope = await supabaseOrders.attachReceipt(
      order.orderNumber,
      `${randomUUID()}/x.jpg`,
    );
    expect(wrongScope.ok).toBe(false);
    const fresh = await uploadedReceipt(order.idempotencyKey);
    expect((await supabaseOrders.attachReceipt(order.orderNumber, fresh)).ok).toBe(true);
    expect(await supabaseAdmin.order(order.orderNumber)).toMatchObject({
      paymentStatus: "awaiting_confirmation",
      receiptPath: fresh,
    });
    expect((await supabaseOrders.attachReceipt(order.orderNumber, fresh)).ok).toBe(false); // nothing to replace now

    // Reject again, then let the window pass.
    await supabaseAdmin.setPaymentDecision(order.orderNumber, "rejected", owner);
    const { product, size, colour } = await stockedProduct();
    const before =
      (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
        (v) => v.size === size && v.color === colour,
      )?.qty ?? 0;
    await admin
      .from("orders")
      .update({ receipt_reupload_until: new Date(Date.now() - 60_000).toISOString() })
      .eq("order_number", order.orderNumber);
    expect(
      (
        await supabaseOrders.attachReceipt(
          order.orderNumber,
          await uploadedReceipt(order.idempotencyKey),
        )
      ).ok,
    ).toBe(false);
    expect(await supabaseOrders.expireUnpaid()).toBeGreaterThanOrEqual(1);
    expect((await supabaseAdmin.order(order.orderNumber))?.status).toBe("cancelled");
    const after =
      (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
        (v) => v.size === size && v.color === colour,
      )?.qty ?? 0;
    expect(after).toBe(before + 1);
    expect(await supabaseOrders.expireUnpaid()).toBe(0);
  });

  it("records a refund owed when a paid order is cancelled, and gives the stock back once", async () => {
    const order = await placedOrder();
    const { product, size, colour } = await stockedProduct();
    const before =
      (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
        (v) => v.size === size && v.color === colour,
      )?.qty ?? 0;
    await asOwner();
    await supabaseAdmin.setPaymentDecision(order.orderNumber, "confirmed", owner);
    expect((await supabaseAdmin.setOrderStatus(order.orderNumber, "cancelled", owner)).ok).toBe(
      true,
    );
    expect(await supabaseAdmin.order(order.orderNumber)).toMatchObject({
      status: "cancelled",
      paymentStatus: "refund_owed",
    });
    expect((await supabaseAdmin.setOrderStatus(order.orderNumber, "cancelled", owner)).ok).toBe(
      false,
    );
    const after =
      (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
        (v) => v.size === size && v.color === colour,
      )?.qty ?? 0;
    expect(after).toBe(before + 1);
  });

  it("summarises the shop for the dashboard", async () => {
    await asEditor();
    const summary = await supabaseAdmin.summary();
    expect(summary.productCount).toBeGreaterThan(10);
    expect(summary.orderCount).toBeGreaterThan(5);
    expect(summary.recentOrders).toHaveLength(5);
    expect(summary.lowStock.every((p) => p.qty < 10)).toBe(true);
  });
});

describe("customers", () => {
  it("lists them with their order totals, and suspends, restores and deletes one", async () => {
    const person = await createCustomer();
    await asOwner();
    const found = await supabaseAdmin.customers(person.email, page());
    expect(found.items).toHaveLength(1);
    expect(found.items[0]).toMatchObject({
      email: person.email,
      orderCount: 0,
      status: "active",
      returnPrivilege: true,
    });
    const stats = await supabaseAdmin.customerStats(new Date(Date.now() - 86_400_000));
    expect(stats.total).toBeGreaterThan(10);
    expect(stats.newSince).toBeGreaterThanOrEqual(1);

    expect((await supabaseAdmin.setCustomerStatus(person.id, "suspended", owner)).ok).toBe(true);
    expect((await supabaseAdmin.customers(person.email, page())).items[0]?.status).toBe(
      "suspended",
    );
    clearBrowser();
    expect(
      (await supabaseAuth.signIn(person.email, person.password, "customer", { ip: "192.0.2.91" }))
        .ok,
    ).toBe(false);
    await asOwner();
    expect((await supabaseAdmin.setCustomerStatus(person.id, "active", owner)).ok).toBe(true);
    clearBrowser();
    expect(
      (await supabaseAuth.signIn(person.email, person.password, "customer", { ip: "192.0.2.92" }))
        .ok,
    ).toBe(true);
    await asOwner();
    expect((await supabaseAdmin.setReturnPrivilege(person.id, false, owner)).ok).toBe(true);
    expect((await supabaseAdmin.customers(person.email, page())).items[0]?.returnPrivilege).toBe(
      false,
    );

    expect((await supabaseAdmin.setCustomerStatus(owner.id, "banned", owner)).ok).toBe(false); // staff are not customers
    expect((await supabaseAdmin.deleteCustomer(owner.id, owner)).ok).toBe(false);
    expect((await supabaseAdmin.deleteCustomer(person.id, owner)).ok).toBe(true);
    expect((await supabaseAdmin.customers(person.email, page())).items).toHaveLength(0);
    expect((await supabaseAdmin.deleteCustomer(person.id, owner)).ok).toBe(false);
  });

  it("keeps a deleted customer's orders, de-linked", async () => {
    const person = await createCustomer();
    clearBrowser();
    const user = await signInAs(person.email, person.password);
    const placed = await supabaseOrders.place(await orderInput({ email: person.email }), {
      userId: user.id,
    });
    if (!placed.ok) throw new Error("not placed");
    await asOwner();
    expect((await supabaseAdmin.customers(person.email, page())).items[0]?.orderCount).toBe(1);
    await supabaseAdmin.deleteCustomer(person.id, owner);
    const kept = await supabaseAdmin.order(placed.order.orderNumber);
    expect(kept?.userId).toBeNull();
    expect(kept?.email).toBe(person.email);
  });
});

describe("promo codes", () => {
  it("creates, switches, validates and deletes a code", async () => {
    await asOwner();
    const code = `TEST${randomUUID().slice(0, 6).toUpperCase()}`;
    const made = await supabaseAdmin.savePromo(
      {
        code: code.toLowerCase(),
        percent: 25,
        expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        usageLimit: 3,
      },
      owner,
    );
    if (!made.ok) throw new Error(made.message);
    expect(made.value).toMatchObject({
      code,
      percent: 25,
      active: true,
      usageLimit: 3,
      usedCount: 0,
    });
    expect(
      (
        await supabaseAdmin.savePromo(
          { code, percent: 5, expiresAt: null, usageLimit: null },
          owner,
        )
      ).ok,
    ).toBe(false);
    expect((await supabaseOrders.validatePromo(code)).ok).toBe(true);
    expect((await supabaseAdmin.setPromoActive(made.value.id, false, owner)).ok).toBe(true);
    expect((await supabaseOrders.validatePromo(code)).ok).toBe(false);
    expect(
      (await supabaseAdmin.promos(page(100))).items.some(
        (p) => p.id === made.value.id && !p.active,
      ),
    ).toBe(true);
    expect((await supabaseAdmin.deletePromo(made.value.id, owner)).ok).toBe(true);
    expect((await supabaseAdmin.deletePromo(made.value.id, owner)).ok).toBe(false);
  });
});

describe("messages", () => {
  it("shows the inbox, marks, replies and deletes", async () => {
    const email = uniqueEmail("msg");
    await supabaseContact.submit({
      name: "Bisi Ade",
      email,
      subject: "order",
      orderNumber: "LBS-01012026-0001",
      message: "Where is my parcel?",
    });
    await asEditor();
    const found = await supabaseAdmin.messages({ search: email }, page());
    expect(found.items).toHaveLength(1);
    const message = found.items[0];
    if (!message) throw new Error("no message");
    expect(message).toMatchObject({
      status: "unread",
      subject: "Order enquiry",
      orderNumber: "LBS-01012026-0001",
      replies: [],
    });
    const counts = await supabaseAdmin.messageCounts();
    expect(counts.all).toBeGreaterThanOrEqual(5);
    expect(counts.unread).toBeGreaterThanOrEqual(1);
    expect((await supabaseAdmin.markMessage(message.id, "read", editor)).ok).toBe(true);
    expect((await supabaseAdmin.message(message.id))?.status).toBe("read");
    expect((await supabaseAdmin.replyToMessage(message.id, "It ships tomorrow.", editor)).ok).toBe(
      true,
    );
    const replied = await supabaseAdmin.message(message.id);
    expect(replied?.status).toBe("replied");
    expect(replied?.replies[0]).toMatchObject({ author: "Demo", body: "It ships tomorrow." });
    expect((await supabaseAdmin.markMessage(message.id, "read", editor)).ok).toBe(true);
    expect((await supabaseAdmin.message(message.id))?.status).toBe("replied"); // a reply is not undone by marking read
    expect(
      (await supabaseAdmin.messages({ status: "replied" }, page(50))).items.some(
        (m) => m.id === message.id,
      ),
    ).toBe(true);
    expect((await supabaseAdmin.deleteMessage(message.id, editor)).ok).toBe(true);
    expect(await supabaseAdmin.message(message.id)).toBeNull();
    expect((await supabaseAdmin.replyToMessage(message.id, "Hello", editor)).ok).toBe(false);
  });
});

describe("analytics and settings", () => {
  it("reports real figures for the period", async () => {
    await asOwner();
    for (const days of [7, 30, 90] as const) {
      const report = await supabaseAdmin.analytics(days);
      expect(report.series).toHaveLength(days);
      expect(report.sample).toBe(false);
      expect(report.series.reduce((n, d) => n + d.orders, 0)).toBe(report.orders);
    }
    const ninety = await supabaseAdmin.analytics(90);
    expect(ninety.orders).toBeGreaterThan(5);
    expect(ninety.topProducts.length).toBeGreaterThan(0);
    expect(ninety.states.length).toBeGreaterThan(0);
    expect(ninety.statusBreakdown.map((s) => s.label)).toContain("delivered");
  });

  it("starts from the shop's own details and keeps what the owner saves", async () => {
    await asOwner();
    const first = await supabaseAdmin.settings();
    expect(first.bankName).toBe("Moniepoint MFB");
    const next = {
      ...first,
      announcement: `Sale ${randomUUID().slice(0, 4)}`,
      lowStockThreshold: 3,
    };
    expect((await supabaseAdmin.saveSettings(next, owner)).ok).toBe(true);
    expect(await supabaseAdmin.settings()).toEqual(next);
    expect((await supabaseAdmin.saveSettings({ ...next, lowStockThreshold: 4 }, owner)).ok).toBe(
      true,
    );
    expect((await supabaseAdmin.settings()).lowStockThreshold).toBe(4);
  });
});

describe("staff and invitations", () => {
  it("lists staff, promotes and demotes an editor, and protects the owner", async () => {
    await asOwner();
    const team = await supabaseAdmin.staff();
    expect(team.map((m) => m.role)).toEqual(["owner", "editor"]);
    const editorRow = team.find((m) => m.role === "editor");
    if (!editorRow) throw new Error("no editor");
    expect((await supabaseAdmin.setStaffRole(editorRow.id, "super_admin", owner)).ok).toBe(true);
    expect((await supabaseAdmin.staff()).find((m) => m.id === editorRow.id)?.role).toBe(
      "super_admin",
    );
    expect((await supabaseAdmin.setStaffRole(editorRow.id, "editor", owner)).ok).toBe(true);
    const own = await supabaseAdmin.setStaffRole(owner.id, "editor", owner);
    expect(own.ok).toBe(false);
    expect((await supabaseAdmin.removeStaff(owner.id, owner)).ok).toBe(false);
    expect((await supabaseAdmin.setStaffRole(randomUUID(), "editor", owner)).ok).toBe(false);
  });

  it("invites by address and role, once, and the role arrives only through the invitation", async () => {
    await asOwner();
    const email = uniqueEmail("invitee");
    const invited = await supabaseAdmin.inviteStaff(email, "editor", owner);
    if (!invited.ok) throw new Error(invited.message);
    const token = new URL(invited.value.link, "http://x").searchParams.get("invite");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const { data: stored } = await admin
      .from("admin_invites")
      .select("token_hash,invited_role")
      .eq("email", email)
      .single();
    expect(stored?.token_hash).not.toBe(token); // only the hash is stored
    expect(stored?.invited_role).toBe("editor");
    // Someone who signs up with the right token and address becomes an editor; with another address, a customer.
    clearBrowser();
    const stranger = await admin.auth.admin.createUser({
      email: uniqueEmail("other"),
      password: "Sample-Pass1!",
      email_confirm: true,
      user_metadata: { invite_token: token },
    });
    const { data: p1 } = await admin
      .from("profiles")
      .select("role")
      .eq("id", stranger.data.user?.id as string)
      .single();
    expect(p1?.role).toBe("customer");
    const made = await admin.auth.admin.createUser({
      email,
      password: "Sample-Pass1!",
      email_confirm: true,
      user_metadata: { invite_token: token },
    });
    const { data: p2 } = await admin
      .from("profiles")
      .select("role")
      .eq("id", made.data.user?.id as string)
      .single();
    expect(p2?.role).toBe("editor");
    const reuse = await admin.auth.admin.createUser({
      email: uniqueEmail("late"),
      password: "Sample-Pass1!",
      email_confirm: true,
      user_metadata: { invite_token: token },
    });
    const { data: p3 } = await admin
      .from("profiles")
      .select("role")
      .eq("id", reuse.data.user?.id as string)
      .single();
    expect(p3?.role).toBe("customer");
    await asOwner();
    expect((await supabaseAdmin.removeStaff(made.data.user?.id as string, owner)).ok).toBe(true);
    clearBrowser();
    expect(
      (await supabaseAuth.signIn(email, "Sample-Pass1!", "staff", { ip: "192.0.2.99" })).ok,
    ).toBe(false);
  });

  it("keeps an activity log the owner can search", async () => {
    await asOwner();
    await supabaseAdmin.saveSettings(
      { ...(await supabaseAdmin.settings()), announcement: "Log me" },
      owner,
    );
    const log = await supabaseAdmin.activity("settings", page());
    expect(log.total).toBeGreaterThan(0);
    expect(log.items[0]).toMatchObject({
      action: "settings saved",
      actor: "Demo Owner",
      role: "owner",
    });
    expect((await supabaseAdmin.activity("Demo Owner", page())).total).toBeGreaterThan(0);
    await asEditor();
    await expect(supabaseAdmin.activity("", page())).resolves.toMatchObject({ total: 0 }); // an editor sees no log
  });
});

describe("account deletion and export", () => {
  it("lets a customer see only their own data", async () => {
    const a = await createCustomer();
    clearBrowser();
    const user = await signInAs(a.email, a.password);
    expect(await supabaseAccount.exportData(user.id)).toContain(a.email);
    const other = await createCustomer();
    expect(await supabaseAccount.profile(other.id)).toBeNull();
  });
});
