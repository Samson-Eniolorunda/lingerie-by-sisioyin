"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button, ButtonRow } from "@/components/ui/Button";
import { createLocalStore } from "@/lib/local-store";
import {
  CONSENT_KEY,
  makeConsent,
  parseConsent,
  type ConsentChoice,
  type ConsentRecord,
} from "@/lib/consent";

export const consentStore = createLocalStore<ConsentRecord | null>(CONSENT_KEY, null, parseConsent);
const REOPEN = "lbs-consent-reopen";

export function useConsent(): ConsentRecord | null {
  return useSyncExternalStore(consentStore.subscribe, consentStore.get, consentStore.serverValue);
}

export function chooseConsent(choice: ConsentChoice): void {
  consentStore.set(makeConsent(choice));
}

/** A footer link that brings the card back so the choice can be changed at any time. */
export function CookieSettingsButton({ className }: { readonly className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(REOPEN))}
      className={className}
    >
      Cookie settings
    </button>
  );
}

/**
 * Asked once, in plain words, with both answers equally easy: "Essential only" on the left and
 * "Accept analytics" on the right. It does not cover the page or block it.
 */
export function ConsentBanner() {
  const record = useConsent();
  const [reopened, setReopened] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(REOPEN, open);
    return () => window.removeEventListener(REOPEN, open);
  }, []);

  const answer = useCallback((choice: ConsentChoice) => {
    chooseConsent(choice);
    setReopened(false);
  }, []);

  if (!hydrated || (record !== null && !reopened)) return null;
  return (
    <section
      aria-labelledby="consent-title"
      data-print="hide"
      className="fixed inset-x-0 z-[calc(var(--z-toast)+1)] mx-auto w-[min(32rem,calc(100vw-1.5rem))] border border-line bg-surface p-4 shadow-lg"
      style={{ bottom: "calc(var(--bottom-nav-h) + var(--safe-bottom) + 0.75rem)" }}
    >
      <h2 id="consent-title" className="font-sans text-base font-semibold">
        Cookies and measuring visits
      </h2>
      <p className="mt-1 text-sm text-muted">
        Essential storage keeps your bag and sign-in. With your permission we also measure visits.{" "}
        <Link href="/privacy#cookies" className="text-primary underline underline-offset-4">
          Privacy policy
        </Link>
      </p>
      <div className="mt-3">
        <ButtonRow
          secondary={
            <Button variant="secondary" onClick={() => answer("essential")}>
              Essential only
            </Button>
          }
          primary={<Button onClick={() => answer("all")}>Accept analytics</Button>}
        />
      </div>
    </section>
  );
}
