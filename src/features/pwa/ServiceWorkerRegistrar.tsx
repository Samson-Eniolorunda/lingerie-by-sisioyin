"use client";

import { useEffect } from "react";

/**
 * Registers the worker in production only. A new version takes over at once and the page reloads one
 * time, so nobody is left on a half-updated app (Q-06).
 */
export function ServiceWorkerRegistrar({
  script,
  scope,
}: {
  readonly script: string;
  readonly scope: string;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Only a worker replacing an earlier one should reload the page, never the very first install.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    const onChange = () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    void navigator.serviceWorker
      .register(script, { scope })
      // Some browsers and embedded views resolve with nothing; never throw from here.
      .then((registration: ServiceWorkerRegistration | undefined) => {
        registration?.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller)
              worker.postMessage("SKIP_WAITING");
          });
        });
      })
      .catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, [script, scope]);
  return null;
}
