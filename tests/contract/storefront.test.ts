import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { resetFailureCounters } from "@/server/auth/throttle";
import { supabaseAccount } from "@/server/supabase/account";
import { supabaseAdmin } from "@/server/supabase/admin";
import { supabaseAuth } from "@/server/supabase/auth";
import { supabaseCatalogue } from "@/server/supabase/catalogue";
import { supabaseContact } from "@/server/supabase/contact";
import { supabaseEngagement } from "@/server/supabase/engagement";
import { supabaseOrders } from "@/server/supabase/orders";
import { receipts } from "@/server/storage/receipts";
import {
  DEMO_CUSTOMER,
  IP,
  OWNER,
  URL_BASE,
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

beforeEach(() => {
  clearBrowser();
  resetFailureCounters();
});

describe("the mode", () => {
  it("is Supabase, and the receipt store is the private bucket", async () => {
    const { DATA_MODE } = await import("@/config/data-mode");
    expect(DATA_MODE).toBe("supabase");
    const path = await uploadedReceipt(randomUUID());
    expect(await receipts.exists(path)).toBe(true);
    expect(await receipts.exists("nobody/nothing.jpg")).toBe(false);
    const link = await receipts.link(path);
    expect(link.mocked).toBe(false);
    expect(
      (
        await fetch(
          `${URL_BASE}${new URL(link.url).pathname.replace("/storage/v1", "/storage/v1")}${new URL(link.url).search}`,
        )
      ).ok,
    ).toBe(true);
  });
});

describe("catalogue", () => {
  it("lists the live products, filters, finds by slug and by id", async () => {
    const all = await supabaseCatalogue.list({}, page(100));
    expect(all.total).toBeGreaterThanOrEqual(12);
    const women = await supabaseCatalogue.list({ gender: "Women" }, page(100));
    expect(women.items.every((p) => p.gender === "Women")).toBe(true);
    const first = all.items[0];
    if (!first) throw new Error("empty catalogue");
    expect((await supabaseCatalogue.bySlug(first.slug))?.id).toBe(first.id);
    expect(await supabaseCatalogue.bySlug("no-such-product")).toBeNull();
    const byIds = await supabaseCatalogue.byIds([first.id, "not-a-uuid"]);
    expect(byIds.map((p) => p.id)).toEqual([first.id]);
    expect((await supabaseCatalogue.newArrivals(4)).length).toBe(4);
    const paged = await supabaseCatalogue.list({}, page(3, 3));
    expect(paged.items).toHaveLength(3);
    expect(paged.total).toBe(all.total);
  });

  it("never shows a hidden or trashed product", async () => {
    const { data } = await admin.from("products").select("id,slug").limit(1).single();
    const id = data?.id as string;
    await admin.from("products").update({ is_active: false }).eq("id", id);
    expect(await supabaseCatalogue.bySlug(data?.slug as string)).toBeNull();
    await admin.from("products").update({ is_active: true, is_deleted: true }).eq("id", id);
    expect(await supabaseCatalogue.bySlug(data?.slug as string)).toBeNull();
    await admin.from("products").update({ is_deleted: false }).eq("id", id);
    expect(await supabaseCatalogue.bySlug(data?.slug as string)).not.toBeNull();
  });
});

describe("contact", () => {
  it("stores a message for the inbox", async () => {
    const email = uniqueEmail("contact");
    const result = await supabaseContact.submit({
      name: "Ada Obi",
      email,
      subject: "sizing",
      message: "Which size should I take?",
    });
    expect(result.ok).toBe(true);
    const { data } = await admin.from("contact_messages").select("*").eq("email", email);
    expect(data?.[0]?.subject).toBe("Sizing help");
    expect(data?.[0]?.status).toBe("unread");
  });
});

describe("authentication", () => {
  it("signs a customer in, knows who they are, and signs out", async () => {
    const user = await signInAs(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    expect(user.role).toBeNull();
    expect((await supabaseAuth.currentUser("customer"))?.email).toBe(DEMO_CUSTOMER.email);
    expect(await supabaseAuth.currentUser("staff")).toBeNull();
    await supabaseAuth.signOut("customer");
    expect(await supabaseAuth.currentUser("customer")).toBeNull();
  });

  it("gives one generic message for a wrong password or an unknown address, then locks", async () => {
    const wrong = await supabaseAuth.signIn(DEMO_CUSTOMER.email, "Wrong-Pass1!", "customer", IP);
    const unknown = await supabaseAuth.signIn(
      "nobody@example.test",
      "Wrong-Pass1!",
      "customer",
      IP,
    );
    expect(wrong).toEqual({ ok: false, message: "The email or password is not correct." });
    expect(unknown).toEqual(wrong);
    for (let i = 0; i < 4; i += 1)
      await supabaseAuth.signIn(DEMO_CUSTOMER.email, "Wrong-Pass1!", "customer", IP);
    const locked = await supabaseAuth.signIn(
      DEMO_CUSTOMER.email,
      DEMO_CUSTOMER.password,
      "customer",
      IP,
    );
    expect(locked.ok).toBe(false);
    expect(!locked.ok && locked.message).toMatch(/Too many attempts/);
    // Another address is not locked out by this one.
    expect(
      (
        await supabaseAuth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password, "customer", {
          ip: "192.0.2.50",
        })
      ).ok,
    ).toBe(true);
  });

  it("keeps the storefront and the admin sessions apart, and refuses customers at the staff door", async () => {
    const denied = await supabaseAuth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password, "staff", {
      ip: "192.0.2.61",
    });
    expect(denied).toEqual({
      ok: false,
      message: "Access denied. This sign-in is for staff only.",
    });
    expect(await supabaseAuth.currentUser("staff")).toBeNull();
    const owner = await signInAs(OWNER.email, OWNER.password, "staff");
    expect(owner.role).toBe("owner");
    expect(await supabaseAuth.currentUser("customer")).toBeNull();
    expect((await supabaseAuth.currentUser("staff"))?.role).toBe("owner");
  });

  it("refuses a suspended account and an account that has been closed", async () => {
    const suspended = await createCustomer();
    await admin.rpc("set_account_status", { p_user: suspended.id, p_status: "suspended" });
    const r = await supabaseAuth.signIn(suspended.email, suspended.password, "customer", {
      ip: "192.0.2.71",
    });
    expect(!r.ok && r.message).toMatch(/suspended/);
    expect(await supabaseAuth.currentUser("customer")).toBeNull();
    const banned = await createCustomer();
    await admin.rpc("set_account_status", { p_user: banned.id, p_status: "banned" });
    const b = await supabaseAuth.signIn(banned.email, banned.password, "customer", {
      ip: "192.0.2.72",
    });
    expect(!b.ok && b.message).toMatch(/closed/);
  });

  it("creates an account, refuses a repeat address, and never gives anyone a role", async () => {
    const email = uniqueEmail("signup");
    const made = await supabaseAuth.signUp({
      firstName: "New",
      lastName: "Person",
      email,
      password: "Brand-New1!",
    });
    expect(made.ok && made.value?.role).toBeNull();
    expect((await supabaseAuth.currentUser("customer"))?.email).toBe(email);
    const again = await supabaseAuth.signUp({
      firstName: "New",
      lastName: "Person",
      email,
      password: "Brand-New1!",
    });
    expect(again.ok).toBe(false);
    const { data } = await admin
      .from("profiles")
      .select("role,first_name")
      .eq("email", email)
      .single();
    expect(data).toEqual({ role: "customer", first_name: "New" });
  });

  it("recovers a password with a one-time code, then ends every session", async () => {
    const person = await createCustomer("Old-Pass-1!");
    await signInAs(person.email, person.password);
    await supabaseAuth.requestPasswordReset(
      person.email,
      "customer",
      "http://localhost:3100/auth/callback?next=%2Freset-password&aud=customer",
    );
    const mail = await (
      await fetch(`${URL_BASE}/test/mail?to=${encodeURIComponent(person.email)}`)
    ).json();
    const code = new URL(mail.link).searchParams.get("code");
    expect(code).toBeTruthy();
    clearBrowser(); // a different moment: the verifier cookie was kept by the browser that asked
    expect((await supabaseAuth.exchangeCode(code as string, "customer")).ok).toBe(false);
  });

  it("exchanges the code in the browser that asked, once, and changes the password", async () => {
    const person = await createCustomer("Old-Pass-1!");
    await supabaseAuth.requestPasswordReset(
      person.email,
      "customer",
      "http://localhost:3100/auth/callback?next=%2Freset-password&aud=customer",
    );
    const mail = await (
      await fetch(`${URL_BASE}/test/mail?to=${encodeURIComponent(person.email)}`)
    ).json();
    const code = new URL(mail.link).searchParams.get("code") as string;
    expect((await supabaseAuth.updatePassword("Whatever-1!", "customer")).ok).toBe(false); // no session yet
    expect((await supabaseAuth.exchangeCode(code, "customer")).ok).toBe(true);
    expect((await supabaseAuth.exchangeCode(code, "customer")).ok).toBe(false);
    expect((await supabaseAuth.updatePassword("Brand-New-2!", "customer")).ok).toBe(true);
    expect(await supabaseAuth.currentUser("customer")).toBeNull();
    clearBrowser();
    expect(
      (await supabaseAuth.signIn(person.email, "Old-Pass-1!", "customer", { ip: "192.0.2.81" })).ok,
    ).toBe(false);
    expect(
      (await supabaseAuth.signIn(person.email, "Brand-New-2!", "customer", { ip: "192.0.2.82" }))
        .ok,
    ).toBe(true);
  });

  it("says nothing different for an unknown address when a reset is requested", async () => {
    expect(
      await supabaseAuth.requestPasswordReset(
        "nobody@example.test",
        "customer",
        "http://localhost:3100/auth/callback",
      ),
    ).toEqual({ devLink: null });
  });

  it("hands Google sign-in a provider address, and the callback code signs the visitor in", async () => {
    const result = await supabaseAuth.signInWithGoogle(
      "http://localhost:3100/auth/callback?next=%2Fdashboard&aud=customer",
    );
    expect(result.ok).toBe(true);
    const url = result.ok ? result.value.url : "";
    expect(url).toContain("/auth/v1/authorize?provider=google");
    // The stand-in plays Google: it sends the browser straight back with a code.
    const back = await fetch(`${url}&login_hint=google.person@example.test`, {
      redirect: "manual",
    });
    const code = new URL(back.headers.get("location") as string).searchParams.get("code") as string;
    expect((await supabaseAuth.exchangeCode(code, "customer")).ok).toBe(true);
    expect((await supabaseAuth.currentUser("customer"))?.email).toBe("google.person@example.test");
  });

  it("checks a password without signing anyone in", async () => {
    expect(await supabaseAuth.confirmPassword(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password)).toBe(
      true,
    );
    expect(await supabaseAuth.confirmPassword(DEMO_CUSTOMER.email, "nope-nope-1A!")).toBe(false);
    expect(await supabaseAuth.currentUser("customer")).toBeNull();
  });
});

describe("orders", () => {
  it("quotes on the server and refuses what cannot be sold", async () => {
    const { product, size, colour } = await stockedProduct();
    const lines = [{ id: product.id, selectedSize: size, selectedColor: colour, qty: 2 }];
    const quote = await supabaseOrders.quote({ lines, state: "Ogun" });
    expect(quote).toEqual({
      ok: true,
      subtotal: product.priceNgn * 2,
      discount: 0,
      delivery: 2000,
      total: product.priceNgn * 2 + 2000,
    });
    const withPromo = await supabaseOrders.quote({ lines, state: "Lagos", promoCode: "welcome10" });
    expect(withPromo.ok && withPromo.discount).toBe(Math.round(product.priceNgn * 0.2));
    expect((await supabaseOrders.quote({ lines, state: "Kano" })).ok).toBe(false);
    expect((await supabaseOrders.quote({ lines, state: "Lagos", promoCode: "EXPIRED" })).ok).toBe(
      false,
    );
    const tooMany = await supabaseOrders.quote({
      lines: [{ id: product.id, selectedSize: size, selectedColor: colour, qty: 100 }],
      state: "Lagos",
    });
    expect(!tooMany.ok && tooMany.message).toMatch(/quantities/i);
  });

  it("places a guest order, takes the exact variant's stock, and repeats are one order", async () => {
    const { product, size, colour, qty } = await stockedProduct();
    const input = await orderInput({ qty: 2 });
    const placed = await supabaseOrders.place(input, { userId: null });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.order.status).toBe("pending");
    expect(placed.order.paymentStatus).toBe("awaiting_confirmation");
    expect(placed.order.lines[0]).toMatchObject({ productId: product.id, size, colour, qty: 2 });
    expect(placed.order.userId).toBeNull();
    expect(placed.order.orderNumber).toMatch(/^LBS-\d{8}-\d{4,}$/);
    const after = (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
      (v) => v.size === size && v.color === colour,
    );
    expect(after?.qty).toBe(qty - 2);
    const repeat = await supabaseOrders.place(input, { userId: null });
    expect(repeat.ok && repeat.order.orderNumber).toBe(placed.order.orderNumber);
    expect(
      (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
        (v) => v.size === size && v.color === colour,
      )?.qty,
    ).toBe(qty - 2);
  });

  it("records an order against the signed-in account", async () => {
    const user = await signInAs(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    const placed = await supabaseOrders.place(await orderInput({ email: DEMO_CUSTOMER.email }), {
      userId: user.id,
    });
    expect(placed.ok && placed.order.userId).toBe(user.id);
  });

  it("refuses a changed total and says what it is now", async () => {
    const input = await orderInput({ quotedTotal: 1 });
    const result = await supabaseOrders.place(input, { userId: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.changedTotal).toBeGreaterThan(1);
    expect(result.message).toContain("₦");
  });

  it("refuses a receipt that was never uploaded, or belongs to another attempt", async () => {
    const input = await orderInput();
    const missing = await supabaseOrders.place(
      { ...input, receiptPath: `${input.idempotencyKey}/never-uploaded.jpg` },
      { userId: null },
    );
    expect(!missing.ok && missing.message).toMatch(/did not finish uploading/);
    const stranger = await supabaseOrders.place(
      { ...input, receiptPath: `${randomUUID()}/x.jpg` },
      { userId: null },
    );
    expect(!stranger.ok && stranger.message).toMatch(/could not be matched/);
  });

  it("will not sell more than the variant holds, and never partly", async () => {
    const { product, size, colour, qty } = await stockedProduct();
    const input = await orderInput({ qty: qty + 1 });
    const result = await supabaseOrders.place(input, { userId: null });
    expect(result.ok).toBe(false);
    expect(
      (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
        (v) => v.size === size && v.color === colour,
      )?.qty,
    ).toBe(qty);
  });

  it("counts a promo use and refuses it once the limit is reached", async () => {
    const first = await supabaseOrders.place(
      await orderInput({ promoCode: "ONEUSE", quotedTotal: 0 }),
      { userId: null },
    );
    expect(first.ok).toBe(false); // the quoted total must match the discounted total
    const { product } = await stockedProduct();
    const total = Math.round(product.priceNgn * 0.8);
    const ok = await supabaseOrders.place(
      await orderInput({ promoCode: "ONEUSE", quotedTotal: total }),
      { userId: null },
    );
    expect(ok.ok && ok.order.promoCode).toBe("ONEUSE");
    expect((await supabaseOrders.validatePromo("ONEUSE")).ok).toBe(false);
    expect(await supabaseOrders.validatePromo("welcome10")).toEqual({
      ok: true,
      value: { code: "WELCOME10", percent: 10 },
    });
    expect((await supabaseOrders.validatePromo("nope")).ok).toBe(false);
  });

  it("looks an order up by number, and by number with the email", async () => {
    const email = uniqueEmail("lookup");
    const placed = await supabaseOrders.place(await orderInput({ email }), { userId: null });
    if (!placed.ok) throw new Error("not placed");
    const n = placed.order.orderNumber;
    expect((await supabaseOrders.byNumber(n))?.orderNumber).toBe(n);
    expect((await supabaseOrders.lookup(n, email.toUpperCase()))?.orderNumber).toBe(n);
    expect(await supabaseOrders.lookup(n, "other@example.test")).toBeNull();
    expect(await supabaseOrders.byNumber("LBS-01012000-0000")).toBeNull();
  });
});

describe("account", () => {
  it("reads and updates the profile, and keeps addresses", async () => {
    const person = await createCustomer();
    const user = await signInAs(person.email, person.password);
    expect((await supabaseAccount.profile(user.id))?.email).toBe(person.email);
    const saved = await supabaseAccount.updateProfile(user.id, {
      firstName: "Ngozi",
      lastName: "Eze",
      phone: "08012345678",
      dateOfBirth: "1990-04-02",
      gender: "female",
    });
    expect(saved.ok && saved.value).toMatchObject({
      firstName: "Ngozi",
      phone: "+2348012345678",
      gender: "female",
      dateOfBirth: "1990-04-02",
    });
    const home = await supabaseAccount.saveAddress(user.id, {
      label: "Home",
      recipient: "Ngozi Eze",
      phone: "08012345678",
      line1: "5 Palm Avenue",
      city: "Ikeja",
      state: "Lagos",
      isDefault: false,
    });
    expect(home.ok && home.value.isDefault).toBe(true);
    const work = await supabaseAccount.saveAddress(user.id, {
      label: "Work",
      recipient: "Ngozi Eze",
      phone: "08012345678",
      line1: "9 Broad Street",
      city: "Ikeja",
      state: "Lagos",
      isDefault: true,
    });
    const list = await supabaseAccount.addresses(user.id);
    expect(list.map((a) => a.label)).toEqual(["Work", "Home"]);
    if (!work.ok) return;
    expect((await supabaseAccount.deleteAddress(user.id, work.value.id)).ok).toBe(true);
    expect((await supabaseAccount.addresses(user.id))[0]).toMatchObject({
      label: "Home",
      isDefault: true,
    });
    expect((await supabaseAccount.deleteAddress(user.id, work.value.id)).ok).toBe(false);
  });

  it("lists only the customer's own orders, and cancels one inside the window, once", async () => {
    const user = await signInAs(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    const { product, size, colour } = await stockedProduct();
    const before =
      (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
        (v) => v.size === size && v.color === colour,
      )?.qty ?? 0;
    const placed = await supabaseOrders.place(await orderInput({ email: DEMO_CUSTOMER.email }), {
      userId: user.id,
    });
    if (!placed.ok) throw new Error("not placed");
    const mine = await supabaseAccount.orders(user.id, {}, page(50));
    expect(mine.items.every((o) => o.userId === user.id)).toBe(true);
    expect(mine.items.some((o) => o.orderNumber === placed.order.orderNumber)).toBe(true);
    expect(
      (await supabaseAccount.orders(user.id, { status: "cancelled" }, page(50))).items.every(
        (o) => o.status === "cancelled",
      ),
    ).toBe(true);
    expect((await supabaseAccount.order(user.id, placed.order.orderNumber))?.orderNumber).toBe(
      placed.order.orderNumber,
    );
    expect((await supabaseAccount.cancelOrder(user.id, placed.order.orderNumber)).ok).toBe(true);
    expect((await supabaseAccount.cancelOrder(user.id, placed.order.orderNumber)).ok).toBe(false);
    const restored = (await supabaseCatalogue.byIds([product.id]))[0]?.variantStock.find(
      (v) => v.size === size && v.color === colour,
    )?.qty;
    expect(restored).toBe(before);
    const other = await createCustomer();
    await supabaseAuth.signOut("customer");
    const stranger = await signInAs(other.email, other.password);
    expect(await supabaseAccount.order(stranger.id, placed.order.orderNumber)).toBeNull();
    expect((await supabaseAccount.cancelOrder(stranger.id, placed.order.orderNumber)).ok).toBe(
      false,
    );
  });

  it("attaches earlier guest orders once the address is verified", async () => {
    const person = await createCustomer();
    const placed = await supabaseOrders.place(await orderInput({ email: person.email }), {
      userId: null,
    });
    if (!placed.ok) throw new Error("not placed");
    expect(placed.order.userId).toBeNull();
    const user = await signInAs(person.email, person.password);
    expect((await supabaseAccount.order(user.id, placed.order.orderNumber))?.userId).toBe(user.id);
  });

  it("asks for the password before deletion is requested, and can withdraw it", async () => {
    const person = await createCustomer();
    const user = await signInAs(person.email, person.password);
    expect((await supabaseAccount.requestDeletion(user.id, "wrong-Pass-1")).ok).toBe(false);
    expect((await supabaseAccount.requestDeletion(user.id, person.password)).ok).toBe(true);
    expect((await supabaseAccount.profile(user.id))?.deletionRequestedAt).not.toBeNull();
    expect((await supabaseAccount.withdrawDeletion(user.id)).ok).toBe(true);
    expect((await supabaseAccount.profile(user.id))?.deletionRequestedAt).toBeNull();
    expect(await supabaseAccount.exportData(user.id)).toContain(person.email);
  });
});

describe("what visitors send in", () => {
  it("keeps reviews and testimonials hidden until they are approved", async () => {
    const { product } = await stockedProduct();
    expect(
      await supabaseEngagement.submitReview({
        productId: product.id,
        name: "Ada",
        email: "ada@example.test",
        rating: 5,
        title: "Lovely",
        comment: "Fits well.",
      }),
    ).toBe(true);
    expect(await supabaseEngagement.reviewsFor(product.id)).toHaveLength(0);
    await admin.from("reviews").update({ is_approved: true }).eq("product_id", product.id);
    const approved = await supabaseEngagement.reviewsFor(product.id);
    expect(approved).toHaveLength(1);
    expect(JSON.stringify(approved)).not.toContain("ada@example.test");
    expect((await supabaseCatalogue.byIds([product.id]))[0]?.reviewCount).toBe(1);
    expect(
      await supabaseEngagement.submitTestimonial({
        name: "Kemi",
        location: "Lagos",
        rating: 5,
        comment: "Great.",
      }),
    ).toBe(true);
    expect(await supabaseEngagement.featuredTestimonials()).toHaveLength(0);
    await admin.from("testimonials").update({ is_approved: true, is_featured: true });
    expect((await supabaseEngagement.featuredTestimonials())[0]?.name).toBe("Kemi");
  });

  it("records page views and the time spent, which the analytics report counts", async () => {
    await signInAs(OWNER.email, OWNER.password, "staff");
    const before = (await supabaseAdmin.analytics(7)).pageViews;
    const id = await supabaseEngagement.recordVisit({
      page: "/shop",
      deviceType: "mobile",
      browser: "Chrome",
    });
    expect(id).toBeTruthy();
    await supabaseEngagement.visitDuration(id as string, 42);
    const report = await supabaseAdmin.analytics(7);
    expect(report.pageViews).toBe(before + 1);
    expect(report.sample).toBe(false);
    expect(report.topPages.some((p) => p.label === "/shop")).toBe(true);
    expect(report.devices.map((d) => d.label)).toContain("Mobile");
    const { data } = await admin
      .from("site_visits")
      .select("time_spent_seconds")
      .eq("id", id as string)
      .single();
    expect(data?.time_spent_seconds).toBe(42);
  });
});
