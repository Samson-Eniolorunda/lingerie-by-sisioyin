import { flutterwaveHashValid } from "./signature";
import { GatewayNotConnectedError, type PaymentProvider, type WebhookEvent } from "./provider";

const ENV = ["FLUTTERWAVE_SECRET_KEY", "FLUTTERWAVE_SECRET_HASH"] as const;

type Env = Readonly<Record<string, string | undefined>>;

/** Flutterwave: prepared, not integrated (see provider.ts). The webhook hash check is real. */
export const flutterwave: PaymentProvider = {
  id: "flutterwave",
  envNames: ENV,
  isConfigured: (env: Env = process.env) => ENV.every((name) => Boolean(env[name])),

  async initialise() {
    throw new GatewayNotConnectedError("flutterwave");
  },
  async verify() {
    throw new GatewayNotConnectedError("flutterwave");
  },
  async refund() {
    throw new GatewayNotConnectedError("flutterwave");
  },

  verifyWebhook(rawBody, headers, env: Env = process.env): WebhookEvent | null {
    if (!flutterwaveHashValid(headers["verif-hash"], env.FLUTTERWAVE_SECRET_HASH)) return null;
    let body: {
      event?: string;
      data?: { id?: number | string; tx_ref?: string; amount?: number; status?: string };
    };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return null;
    }
    const data = body.data ?? {};
    const kind =
      body.event === "charge.completed"
        ? data.status === "successful"
          ? "payment.success"
          : "payment.failed"
        : "other";
    return {
      id: `${body.event ?? "event"}:${data.id ?? data.tx_ref ?? "unknown"}`,
      kind,
      reference: data.tx_ref ?? "",
      amountNgn: typeof data.amount === "number" ? data.amount : null, // already naira
      raw: body,
    };
  },
};
