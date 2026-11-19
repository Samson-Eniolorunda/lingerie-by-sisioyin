import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { resetFailureCounters } from "@/server/auth/throttle";
import type { ProductDraft } from "@/server/data/contracts";
import { supabaseAdmin } from "@/server/supabase/admin";
import { supabaseCatalogue } from "@/server/supabase/catalogue";
import { supabaseOrders } from "@/server/supabase/orders";
import { receipts } from "@/server/storage/receipts";
import type { SessionUser } from "@/types/account";
import {
  OWNER,
  URL_BASE,
  admin,
  clearBrowser,
  orderInput,
  page,
  signInAs,
  stockedProduct,
} from "./helpers";

let owner: SessionUser;
async function asOwner() {
  clearBrowser();
  owner = await signInAs(OWNER.email, OWNER.password, "staff");
}

beforeEach(() => {
  clearBrowser();
  resetFailureCounters();
});

/** The public key, as a script on the internet would hold it. */
async function anonKeyClient() {
  const keys = (await (await fetch(`${URL_BASE}/keys`)).json()) as { anon: string };
  return createClient(URL_BASE, keys.anon, { auth: { persistSession: false } });
}

describe("review fix 1: only the server places orders", () => {
  it("refuses place_order and quote_order to a browser holding the public key", async () => {
    const input = await orderInput();
    const anon = await anonKeyClient();
    const place = await anon.rpc("place_order", {
      p_idempotency_key: input.idempotencyKey,
      p_contact: { name: "A B", email: "a@example.test", phone: "+2348012345678" },
      p_delivery: { address: "12 Marina Road", city: "Ikeja", state: "Lagos" },
      p_lines: input.lines.map((l) => ({
        product_id: l.id,
        size: l.selectedSize,
        colour: l.selectedColor,
        qty: l.qty,
      })),
      p_promo: null,
      p_quoted_total: input.quotedTotal,
      p_receipt_path: null,
    });
    expect(place.error?.code).toBe("42501");
    const quote = await anon.rpc("quote_order", { p_lines: [], p_promo: null, p_state: "Lagos" });
    expect(quote.error?.code).toBe("42501");
  });

  it("refuses a missing receipt, a receipt that was never uploaded and a receipt reused by a second order", async () => {
    const service = admin;
    const base = await orderInput();
    const call = (over: Record<string, unknown>) =>
      service.rpc("place_order", {
        p_idempotency_key: base.idempotencyKey,
        p_contact: { name: "A B", email: "a@example.test", phone: "+2348012345678" },
        p_delivery: { address: "12 Marina Road", city: "Ikeja", state: "Lagos" },
        p_lines: base.lines.map((l) => ({
          product_id: l.id,
          size: l.selectedSize,
          colour: l.selectedColor,
          qty: l.qty,
        })),
        p_promo: null,
        p_quoted_total: base.quotedTotal,
        p_receipt_path: base.receiptPath,
        ...over,
      });
    expect((await call({ p_receipt_path: null })).data).toMatchObject({
      ok: false,
      code: "invalid_receipt",
    });
    expect(
      (await call({ p_receipt_path: `${base.idempotencyKey}/never-uploaded.jpg` })).data,
    ).toMatchObject({ ok: false, code: "invalid_receipt" });
    expect(
      (await call({ p_receipt_path: `${randomUUID()}-other-checkout/x.jpg` })).data,
    ).toMatchObject({ ok: false });
    const placed = await supabaseOrders.place(base, { userId: null });
    expect(placed.ok).toBe(true);
    // The same receipt cannot hold a second order, even under a new key.
    const reused = { ...base, idempotencyKey: randomUUID() };
    const second = await supabaseOrders.place(reused, { userId: null });
    expect(second.ok).toBe(false);
  });
});

describe("review fix 2: money in flight is never lost", () => {
  it("opens a refund check when an order with an unaccepted receipt is cancelled, and lets staff settle it", async () => {
    const placed = await supabaseOrders.place(await orderInput(), { userId: null });
    if (!placed.ok) throw new Error(placed.message);
    await asOwner();
    expect(
      (await supabaseAdmin.setOrderStatus(placed.order.orderNumber, "cancelled", owner)).ok,
    ).toBe(true);
    const cancelled = await supabaseAdmin.order(placed.order.orderNumber);
    expect(cancelled).toMatchObject({ status: "cancelled", paymentStatus: "refund_check" });
    expect((await supabaseAdmin.markRefunded(placed.order.orderNumber, owner)).ok).toBe(false);
    expect((await supabaseAdmin.resolveRefundCheck(placed.order.orderNumber, 5000, owner)).ok).toBe(
      true,
    );
    expect(await supabaseAdmin.order(placed.order.orderNumber)).toMatchObject({
      paymentStatus: "refund_owed",
      refundAmount: 5000,
    });
    expect((await supabaseAdmin.markRefunded(placed.order.orderNumber, owner)).ok).toBe(true);
  });

  it("keeps the receipt of a checkout that failed after the transfer and shows it to staff", async () => {
    const input = await orderInput();
    const failing = { ...input, quotedTotal: input.quotedTotal + 1 }; // the total no longer matches
    const result = await supabaseOrders.place(failing, { userId: null });
    expect(result.ok).toBe(false);
    await asOwner();
    const orphans = await supabaseAdmin.orphanReceipts();
    const found = orphans.find((o) => o.path === input.receiptPath);
    expect(found).toMatchObject({ resolved: false, email: input.contact.email });
    expect(found?.failureId).toBeTruthy();
    expect((await supabaseAdmin.deleteOrphanReceipt(input.receiptPath, owner)).ok).toBe(false); // still open
    expect(
      (await supabaseAdmin.resolveCheckoutFailure(found?.failureId ?? "", "Refunded", owner)).ok,
    ).toBe(true);
    expect((await supabaseAdmin.deleteOrphanReceipt(input.receiptPath, owner)).ok).toBe(true);
    expect(await receipts.exists(input.receiptPath)).toBe(false);
  });
});

describe("review fix 5: an edit never overwrites stock that an order has just taken", () => {
  it("saves the details but not the stock when the stock changed while the form was open", async () => {
    await asOwner();
    const draft: ProductDraft = {
      name: "Stock guard bra",
      category: "Lingerie",
      gender: "Women",
      priceNgn: 9000,
      description: "A test product.",
      deliveryType: "standard",
      isNew: false,
      active: true,
      allowColourSelection: true,
      packType: "Single",
      variants: [{ size: "M", color: "Black", qty: 5 }],
      images: [],
    };
    const created = await supabaseAdmin.createProduct(draft, owner);
    if (!created.ok) throw new Error(created.message);
    const loaded = created.value; // the form is opened here, with this stock version
    // An order takes one unit meanwhile.
    const input = await orderInput({
      line: { id: loaded.id, size: "M", colour: "Black" },
      quotedTotal: 9000,
    });
    expect((await supabaseOrders.place(input, { userId: null })).ok).toBe(true);
    // The editor saves a new price and the stock they saw (5).
    const stale = await supabaseAdmin.updateProduct(
      loaded.id,
      { ...draft, priceNgn: 9500, stockVersion: loaded.stockVersion },
      owner,
    );
    expect(stale.ok).toBe(false);
    const now = (await supabaseCatalogue.byIds([loaded.id]))[0];
    expect(now?.priceNgn).toBe(9500); // the details were saved
    expect(now?.variantStock[0]?.qty).toBe(4); // the order's stock was kept
    // With the current version the stock is written.
    const fresh = await supabaseAdmin.product(loaded.id);
    if (!fresh) throw new Error("product missing");
    const ok = await supabaseAdmin.updateProduct(
      loaded.id,
      {
        ...draft,
        variants: [{ size: "M", color: "Black", qty: 20 }],
        stockVersion: fresh.stockVersion,
      },
      owner,
    );
    expect(ok.ok && ok.value.qty).toBe(20);
    await supabaseAdmin.trashProduct(loaded.id, owner);
    void page;
    void stockedProduct;
  });
});
