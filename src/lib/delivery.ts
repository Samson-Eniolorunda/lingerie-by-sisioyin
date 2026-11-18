export interface DeliveryState {
  readonly id: string;
  readonly label: string;
  readonly feeNgn: number;
}

/**
 * One table for the cart estimate and checkout. Fees mirror `DELIVERY_FEES` in the live
 * `config.js`; the plan (SC-05) moves them into the database so they can be edited without a deploy.
 */
export const DELIVERY_STATES: readonly DeliveryState[] = [
  { id: "Lagos", label: "Lagos", feeNgn: 0 },
  { id: "Ogun", label: "Ogun", feeNgn: 2000 },
  { id: "Oyo", label: "Oyo", feeNgn: 2500 },
  { id: "Osun", label: "Osun", feeNgn: 2500 },
  { id: "Ondo", label: "Ondo", feeNgn: 2500 },
  { id: "Ekiti", label: "Ekiti", feeNgn: 3000 },
  { id: "Abuja", label: "Abuja FCT", feeNgn: 3500 },
];

export function deliveryFeeFor(stateId: string): number | null {
  const state = DELIVERY_STATES.find((s) => s.id === stateId);
  return state ? state.feeNgn : null;
}
