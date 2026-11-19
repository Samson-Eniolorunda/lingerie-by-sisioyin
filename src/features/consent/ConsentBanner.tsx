"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button, ButtonRow } from "@/components/ui/Button";
import { createLocalStore } from "@/lib/local-store";
import {
  consentCookie,
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
  document.cookie = consentCookie(choice, window.location.protocol === "https:");
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
 * "Accept analytics" on the right. On wider screens it is a slim bar along the bottom edge, stopping
 * short of the chat button, so it does not sit on the page text.
 */
export function ConsentBanner({ answered }: { readonly answered: boolean }) {
  const record = useConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(REOPEN, open);
    return () => window.removeEventListener(REOPEN, open);
  }, []);

  const answer = useCallback((choice: ConsentChoice) => {
    chooseConsent(choice);
    setReopened(false);
  }, []);

  // The server renders the card when there is no cookie, so it is in the first paint and never pops in late.
  // A choice kept only in local storage (before the cookie existed) hides it once the page is on the device.
  if (!reopened && (answered || record !== null)) return null;
  return (
    <section
      aria-labelledby="consent-title"
      data-print="hide"
      className="fixed inset-x-0 z-[calc(var(--z-toast)+1)] mx-auto w-[min(32rem,calc(100vw-1.5rem))] border border-line bg-surface p-4 shadow-lg sm:right-20 sm:mx-0 sm:flex sm:w-auto sm:items-center sm:justify-between sm:gap-8 sm:border-x-0 sm:border-b-0 sm:px-8 sm:py-3 sm:shadow-none md:bottom-0!"
      style={{ bottom: "calc(var(--bottom-nav-h) + var(--safe-bottom) + 0.75rem)" }}
    >
      <div className="sm:min-w-0">
        <h2 id="consent-title" className="font-sans text-sm font-semibold">
          Cookies and measuring visits
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          We measure visits only with your permission.{" "}
          <Link href="/privacy#cookies" className="text-primary underline underline-offset-4">
            Privacy policy
          </Link>
        </p>
      </div>
      <div className="mt-3 sm:mt-0 sm:shrink-0">
        <ButtonRow
          secondary={
            <Button
              variant="secondary"
              className="px-2! text-sm! whitespace-nowrap"
              onClick={() => answer("essential")}
            >
              Essential only
            </Button>
          }
          primary={
            <Button className="px-2! text-sm! whitespace-nowrap" onClick={() => answer("all")}>
              Accept analytics
            </Button>
          }
        />
      </div>
    </section>
  );
}
