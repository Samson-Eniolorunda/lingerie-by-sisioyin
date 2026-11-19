import { paystackSignatureValid } from "./signature";
import { GatewayNotConnectedError, type PaymentProvider, type WebhookEvent } from "./provider";

const ENV = ["PAYSTACK_SECRET_KEY"] as const;

type Env = Readonly<Record<string, string | undefined>>;

/** Paystack: prepared, not integrated (see provider.ts). The webhook signature check is real. */
export const paystack: PaymentProvider = {
  id: "paystack",
  envNames: ENV,
  isConfigured: (env: Env = process.env) => ENV.every((name) => Boolean(env[name])),

  async initialise() {
    throw new GatewayNotConnectedError("paystack");
  },
  async verify() {
    throw new GatewayNotConnectedError("paystack");
  },
  async refund() {
    throw new GatewayNotConnectedError("paystack");
  },

  verifyWebhook(rawBody, headers, env: Env = process.env): WebhookEvent | null {
    if (!paystackSignatureValid(rawBody, headers["x-paystack-signature"], env.PAYSTACK_SECRET_KEY))
      return null;
    let body: {
      event?: string;
      data?: { id?: number | string; reference?: string; amount?: number };
    };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return null;
    }
    const data = body.data ?? {};
    const kind =
      body.event === "charge.success"
        ? "payment.success"
        : body.event === "charge.failed"
          ? "payment.failed"
          : body.event === "refund.processed"
            ? "refund.processed"
            : "other";
    return {
      // Paystack has no event id of its own; the event name with the transaction id is stable per delivery.
      id: `${body.event ?? "event"}:${data.id ?? data.reference ?? "unknown"}`,
      kind,
      reference: data.reference ?? "",
      amountNgn: typeof data.amount === "number" ? data.amount / 100 : null, // kobo to naira
      raw: body,
    };
  },
};
