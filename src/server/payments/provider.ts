import type { PaymentMethodId } from "@/types/account";

/**
 * The shape every card or transfer gateway must fill. Paystack and Flutterwave are PREPARED here
 * but NOT integrated: their calls to the provider's servers raise `GatewayNotConnectedError`, and
 * the admin shows them as "Not connected". Connecting one means filling in `initialise`, `verify`
 * and `refund` in its file, setting its environment variables (names in OWNER_SETUP.md), and having
 * the developer set `connected` in the database; nothing else in the shop has to change.
 */
export type GatewayId = Exclude<PaymentMethodId, "bank_transfer">;

export interface InitialiseInput {
  /** Our order number: the gateway's reference for the payment. */
  readonly orderNumber: string;
  /** The amount in naira; the provider wants kobo, which each implementation converts. */
  readonly amountNgn: number;
  readonly email: string;
  /** Where the provider sends the customer back to after paying. */
  readonly callbackUrl: string;
}

export interface InitialiseResult {
  /** The provider's own page for the customer to pay on. */
  readonly checkoutUrl: string;
  readonly reference: string;
}

export interface VerifyResult {
  readonly reference: string;
  readonly status: "success" | "failed" | "pending";
  /** Always asked of the provider's server, never taken from the browser or the webhook body alone. */
  readonly amountNgn: number;
}

export interface RefundResult {
  readonly reference: string;
  readonly status: "queued" | "processed" | "failed";
}

/** A webhook whose signature has been checked. */
export interface WebhookEvent {
  /** Unique per delivery at the provider; a replay carries the same id and is ignored. */
  readonly id: string;
  readonly kind: "payment.success" | "payment.failed" | "refund.processed" | "other";
  readonly reference: string;
  readonly amountNgn: number | null;
  readonly raw: unknown;
}

export class GatewayNotConnectedError extends Error {
  constructor(readonly gateway: GatewayId) {
    super(`${gateway} is prepared but not connected.`);
    this.name = "GatewayNotConnectedError";
  }
}

export interface PaymentProvider {
  readonly id: GatewayId;
  /** Names of the environment variables this provider needs (never their values). */
  readonly envNames: readonly string[];
  /** True when every environment variable it needs is set. */
  isConfigured(env?: Readonly<Record<string, string | undefined>>): boolean;
  initialise(input: InitialiseInput): Promise<InitialiseResult>;
  verify(reference: string): Promise<VerifyResult>;
  /**
   * Checks the webhook's signature against the raw request body and returns the event, or null when
   * the signature is missing or wrong. Implemented now, because it is pure and must be right before
   * anything is switched on.
   */
  verifyWebhook(
    rawBody: string,
    headers: Readonly<Record<string, string | null | undefined>>,
    env?: Readonly<Record<string, string | undefined>>,
  ): WebhookEvent | null;
  refund(reference: string, amountNgn: number): Promise<RefundResult>;
}
