import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOutbox, deliver, outbox, sendOrderPlaced, sendPaymentRejected } from "@/server/email";
import * as t from "@/server/email/templates";
import { memoryTransport, resendTransport } from "@/server/email/transport";
import { DEMO, getDb, resetDb } from "@/server/mock/db";
import type { BankDetails } from "@/types/account";
import type { StoredOrder } from "@/types/orders";

const ctx = {
  siteUrl: "https://www.lingeriebysisioyin.store",
  supportEmail: "support@lingeriebysisioyin.store",
  whatsappNumber: "2349033344860",
};
const bank: BankDetails = {
  bankName: "Access Bank",
  accountNumber: "0123456789",
  accountName: "Sisioyin Stores",
  note: "Use your order number",
};
const order: StoredOrder = {
  orderNumber: "LBS-01012026-0001",
  userId: null,
  email: "ada@example.com",
  phone: "+2348012345678",
  customerName: "Ada <script>alert(1)</script> Obi",
  address: "12 Marina Road",
  city: "Ikeja",
  state: "Lagos",
  landmark: "",
  lines: [
    { productId: "p1", name: "Lace Bra", size: "M", colour: "Black", qty: 2, unitPriceNgn: 10000 },
  ],
  subtotal: 20000,
  discount: 2000,
  delivery: 0,
  total: 18000,
  promoCode: "SAVE10",
  status: "pending",
  paymentStatus: "awaiting_confirmation",
  receiptPath: "k/r.jpg",
  receiptReuploadUntil: "2026-03-14T10:00:00.000Z",
  idempotencyKey: "key-key-key-key-key",
  notes: "",
  createdAt: "2026-03-12T10:00:00.000Z",
  updatedAt: "2026-03-12T10:00:00.000Z",
};

beforeEach(() => {
  clearOutbox();
  resetDb();
});

describe("e-mail templates", () => {
  it("tells only signed-in customers that they can cancel online", () => {
    const guest = t.orderConfirmation({ ...order, userId: null }, bank, ctx).html;
    expect(guest).not.toMatch(/cancel it online/i);
    expect(guest).toContain("reply to this e-mail");
    const member = t.orderConfirmation({ ...order, userId: "user-1" }, bank, ctx).html;
    expect(member).toContain("cancel it online from your account");
  });

  it("confirm an order with its lines, total, delivery address and the stored bank details", () => {
    const m = t.orderConfirmation(order, bank, ctx);
    expect(m.subject).toBe("Your order LBS-01012026-0001 · Lingeries by Sisioyin");
    for (const part of [
      "LBS-01012026-0001",
      "Lace Bra",
      "₦18,000",
      "0123456789",
      "Access Bank",
      "Sisioyin Stores",
      "Use your order number",
      "Ikeja",
    ]) {
      expect(m.html).toContain(part);
      expect(m.text).toContain(part);
    }
    expect(m.html).toContain('lang="en-GB"');
  });

  it("escape everything a customer typed", () => {
    const m = t.orderConfirmation({ ...order, address: "<script>alert(1)</script>" }, bank, ctx);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(
      t.contactReply(
        { name: "A", subject: "Hi <b>", original: "<img src=x>", reply: "Fine & dandy" },
        ctx,
      ).html,
    ).not.toContain("<img");
  });

  it("say the details are being updated when none are saved", () => {
    expect(t.orderConfirmation(order, null, ctx).html).toContain(
      "Payment details are being updated",
    );
    expect(t.paymentRejected(order, null, null, ctx).text).toContain(
      "Payment details are being updated",
    );
  });

  it("cover payment confirmed, rejected with its deadline, shipped and a contact reply", () => {
    expect(t.paymentConfirmed(order, ctx).subject).toBe(
      "Payment confirmed for order LBS-01012026-0001",
    );
    const rejected = t.paymentRejected(order, bank, order.receiptReuploadUntil, ctx);
    expect(rejected.text).toMatch(/14 March 2026/);
    expect(rejected.html).toContain("/track?order=LBS-01012026-0001");
    expect(t.orderShipped(order, ctx).html).toContain("Ikeja");
    const reply = t.contactReply(
      {
        name: "Ada Obi",
        subject: "Sizing",
        original: "Which size?",
        reply: "Take the 34B.\n\nKind.",
      },
      ctx,
    );
    expect(reply.subject).toBe("Re: Sizing");
    expect(reply.text).toContain("> Which size?");
  });
});

describe("e-mail transports", () => {
  it("Resend: posts the message with the key and the from address, and reports its id", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ id: "re_123" }), { status: 200 }),
    );
    const result = await resendTransport(
      "re_key",
      "Shop <orders@lingeriebysisioyin.store>",
      fetcher,
    ).send({
      to: "ada@example.com",
      subject: "S",
      html: "<p>h</p>",
      text: "t",
      replyTo: "support@x.co",
    });
    expect(result).toEqual({ ok: true, id: "re_123" });
    const [url = "", init = {}] = fetcher.mock.calls[0] ?? [];
    const sent: RequestInit = init;
    expect(url).toBe("https://api.resend.com/emails");
    expect((sent.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(String(sent.body))).toMatchObject({
      from: "Shop <orders@lingeriebysisioyin.store>",
      to: ["ada@example.com"],
      reply_to: "support@x.co",
    });
  });

  it("Resend: reports a refusal or an unreachable service instead of throwing", async () => {
    const refused = vi.fn(async () => new Response("no", { status: 422 }));
    expect(
      await resendTransport("k", "f", refused).send({
        to: "a@b.co",
        subject: "",
        html: "",
        text: "",
      }),
    ).toEqual({ ok: false, reason: "Resend answered 422." });
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(
      (
        await resendTransport("k", "f", down).send({
          to: "a@b.co",
          subject: "",
          html: "",
          text: "",
        })
      ).ok,
    ).toBe(false);
  });

  it("the in-memory transport keeps what it was given", async () => {
    await memoryTransport.send({ to: "a@b.co", subject: "S", html: "h", text: "t" });
    expect(outbox().map((m) => m.subject)).toEqual(["S"]);
  });

  it("deliver never throws, even when the transport fails", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const original = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "k";
    process.env.EMAIL_FROM_ADDRESS = "from@x.co";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(
      deliver({ to: "a@b.co", subject: "S", html: "h", text: "t" }, "test"),
    ).resolves.toMatchObject({ ok: false });
    vi.unstubAllGlobals();
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
    delete process.env.EMAIL_FROM_ADDRESS;
    spy.mockRestore();
  });
});

describe("e-mail senders (development store)", () => {
  it("sends the confirmation to the customer and, when switched on, a note to the shop", async () => {
    getDb().bank = bank;
    await sendOrderPlaced(order);
    const subjects = outbox().map((m) => m.subject);
    expect(subjects[0]).toContain("Your order LBS-01012026-0001");
    expect(outbox()[0]?.to).toBe("ada@example.com");
    expect(outbox()[0]?.html).toContain("Access Bank");
    expect(subjects.some((s) => s.startsWith("New order"))).toBe(true);
    clearOutbox();
    getDb().settings = { ...getDb().settings, notifyNewOrders: false };
    await sendOrderPlaced(order);
    expect(outbox()).toHaveLength(1);
  });

  it("sends a rejection with the re-upload deadline", async () => {
    await sendPaymentRejected(order);
    expect(outbox()[0]?.subject).toContain("Action needed");
    void DEMO;
  });
});
