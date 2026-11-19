import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { flutterwave } from "@/server/payments/flutterwave";
import { paystack } from "@/server/payments/paystack";
import { GatewayNotConnectedError } from "@/server/payments/provider";
import { flutterwaveHashValid, paystackSignatureValid } from "@/server/payments/signature";

const body = JSON.stringify({
  event: "charge.success",
  data: { id: 42, reference: "LBS-01012026-0001", amount: 1500000 },
});
const sign = (b: string, key: string) => createHmac("sha512", key).update(b).digest("hex");

describe("Paystack and Flutterwave are prepared, not connected", () => {
  it("refuse to initialise, verify or refund until they are integrated", async () => {
    for (const provider of [paystack, flutterwave]) {
      await expect(
        provider.initialise({ orderNumber: "X", amountNgn: 1, email: "a@b.co", callbackUrl: "/" }),
      ).rejects.toBeInstanceOf(GatewayNotConnectedError);
      await expect(provider.verify("x")).rejects.toBeInstanceOf(GatewayNotConnectedError);
      await expect(provider.refund("x", 1)).rejects.toBeInstanceOf(GatewayNotConnectedError);
    }
  });

  it("report whether their environment variables are set, by name only", () => {
    expect(paystack.envNames).toEqual(["PAYSTACK_SECRET_KEY"]);
    expect(flutterwave.envNames).toEqual(["FLUTTERWAVE_SECRET_KEY", "FLUTTERWAVE_SECRET_HASH"]);
    expect(paystack.isConfigured({})).toBe(false);
    expect(paystack.isConfigured({ PAYSTACK_SECRET_KEY: "k" })).toBe(true);
    expect(flutterwave.isConfigured({ FLUTTERWAVE_SECRET_KEY: "k" })).toBe(false);
  });
});

describe("webhook signatures", () => {
  it("accepts Paystack's HMAC SHA-512 of the raw body and nothing else", () => {
    const good = sign(body, "sk_test_secret");
    expect(paystackSignatureValid(body, good, "sk_test_secret")).toBe(true);
    expect(paystackSignatureValid(body + " ", good, "sk_test_secret")).toBe(false); // body changed
    expect(paystackSignatureValid(body, good, "another")).toBe(false); // wrong key
    expect(paystackSignatureValid(body, "", "sk_test_secret")).toBe(false);
    expect(paystackSignatureValid(body, undefined, "sk_test_secret")).toBe(false);
    expect(paystackSignatureValid(body, good, undefined)).toBe(false);
    expect(paystackSignatureValid(body, "abc", "sk_test_secret")).toBe(false); // wrong length
  });

  it("turns a signed Paystack delivery into an event in naira, and refuses an unsigned one", () => {
    const env = { PAYSTACK_SECRET_KEY: "sk_test_secret" };
    const event = paystack.verifyWebhook(
      body,
      { "x-paystack-signature": sign(body, "sk_test_secret") },
      env,
    );
    expect(event).toMatchObject({
      kind: "payment.success",
      reference: "LBS-01012026-0001",
      amountNgn: 15000,
      id: "charge.success:42",
    });
    expect(paystack.verifyWebhook(body, {}, env)).toBeNull();
    expect(
      paystack.verifyWebhook(
        "not json",
        { "x-paystack-signature": sign("not json", "sk_test_secret") },
        env,
      ),
    ).toBeNull();
  });

  it("checks Flutterwave's secret hash header", () => {
    expect(flutterwaveHashValid("hash-1", "hash-1")).toBe(true);
    expect(flutterwaveHashValid("hash-2", "hash-1")).toBe(false);
    expect(flutterwaveHashValid(null, "hash-1")).toBe(false);
    expect(flutterwaveHashValid("hash-1", undefined)).toBe(false);
    const raw = JSON.stringify({
      event: "charge.completed",
      data: { id: 7, tx_ref: "LBS-1", amount: 5000, status: "successful" },
    });
    const env = { FLUTTERWAVE_SECRET_HASH: "hash-1", FLUTTERWAVE_SECRET_KEY: "k" };
    expect(flutterwave.verifyWebhook(raw, { "verif-hash": "hash-1" }, env)).toMatchObject({
      kind: "payment.success",
      amountNgn: 5000,
      reference: "LBS-1",
    });
    expect(flutterwave.verifyWebhook(raw, { "verif-hash": "nope" }, env)).toBeNull();
  });
});
