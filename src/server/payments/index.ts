import { flutterwave } from "./flutterwave";
import { paystack } from "./paystack";
import type { GatewayId, PaymentProvider } from "./provider";

export const PROVIDERS: Readonly<Record<GatewayId, PaymentProvider>> = { paystack, flutterwave };

export type { GatewayId, PaymentProvider } from "./provider";
export { GatewayNotConnectedError } from "./provider";
