"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { turnstileSiteKey } from "@/lib/turnstile";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      theme: "light" | "dark";
      size: "flexible";
      language: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;

/** Loads Cloudflare's script once, on the first page that shows the check. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    // The page's own scripts carry the nonce the content security policy allows.
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    if (nonce) script.nonce = nonce;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not start."));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Turnstile could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

function watchTheme(notify: () => void): () => void {
  const watcher = new MutationObserver(notify);
  watcher.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => watcher.disconnect();
}

const currentTheme = (): "light" | "dark" =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

/**
 * State for a form with the check: the latest token, and `reset`, to be called after every answer
 * from the server (a token works once). With no site key (development, tests) the check is not
 * required and `ready` is always true.
 */
export function useTurnstile() {
  const required = turnstileSiteKey() !== null;
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const reset = useCallback(() => {
    setToken(null);
    setResetSignal((n) => n + 1);
  }, []);
  return { required, token, setToken, resetSignal, reset, ready: !required || token !== null };
}

/**
 * The Cloudflare Turnstile widget in managed mode. It follows the site's light or dark theme and
 * fills the width of the form (at least 300 px, so it fits a 360 px phone). Its box has a fixed
 * height from the start, so the form does not move when the widget appears.
 */
export function Turnstile({
  onToken,
  resetSignal,
}: {
  readonly onToken: (token: string | null) => void;
  readonly resetSignal: number;
}) {
  const siteKey = turnstileSiteKey();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const callback = useRef(onToken);
  const theme = useSyncExternalStore(watchTheme, currentTheme, () => "light" as const);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    const element = box.current;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        setFailed(false);
        widget.current = api.render(element, {
          sitekey: siteKey,
          theme,
          size: "flexible",
          language: "en",
          callback: (token) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => {
            callback.current(null);
            setFailed(true);
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widget.current) callback.current(null);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [siteKey, theme]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [resetSignal]);

  if (!siteKey) return null;
  return (
    <div role="group" aria-label="Security check">
      <div ref={box} data-testid="turnstile" className="min-h-[65px] w-full" />
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-error">
          The security check could not be loaded. Please refresh the page and try again.
        </p>
      ) : null}
    </div>
  );
}
