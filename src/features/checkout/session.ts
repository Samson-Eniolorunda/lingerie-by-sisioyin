"use client";

import "@/lib/zod-config";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { createLocalStore } from "@/lib/local-store";

export const CHECKOUT_KEY = "LBS_CHECKOUT_V1";

const schema = z.object({
  state: z.string().default(""),
  promo: z
    .object({ code: z.string(), percent: z.number().min(0).max(100) })
    .nullable()
    .default(null),
});

export type CheckoutChoices = z.infer<typeof schema>;

const EMPTY: CheckoutChoices = { state: "", promo: null };

const store = createLocalStore<CheckoutChoices>(CHECKOUT_KEY, EMPTY, (raw) => {
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
});

export function useCheckoutChoices(): CheckoutChoices {
  return useSyncExternalStore(store.subscribe, store.get, store.serverValue);
}

export function setCheckoutChoices(patch: Partial<CheckoutChoices>): void {
  store.set({ ...store.get(), ...patch });
}

export function resetCheckoutChoices(): void {
  store.set(EMPTY);
}
