import { analyticsAllowed, CONSENT_KEY, parseConsent } from "./consent";
import { readStorage } from "./storage";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export function consentGiven(): boolean {
  const raw = readStorage(CONSENT_KEY);
  if (raw === null) return false;
  try {
    return analyticsAllowed(parseConsent(JSON.parse(raw)));
  } catch {
    return false;
  }
}

/** Sends an e-commerce event to the tools that are loaded, and only with consent. Safe to call anywhere. */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || !consentGiven()) return;
  window.gtag?.("event", event, params);
  const pixel: Record<string, string> = {
    add_to_cart: "AddToCart",
    begin_checkout: "InitiateCheckout",
    purchase: "Purchase",
    view_item: "ViewContent",
    search: "Search",
  };
  const name = pixel[event];
  if (name) window.fbq?.("track", name, params);
}
