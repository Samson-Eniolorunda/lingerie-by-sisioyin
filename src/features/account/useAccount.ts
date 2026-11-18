"use client";

import { useEffect, useState } from "react";

export type AccountState =
  | { readonly status: "loading" }
  | { readonly status: "signed-out" }
  | { readonly status: "signed-in"; readonly firstName: string; readonly initials: string };

/** Asks the server who is signed in, only while `enabled`, so static pages stay static. */
export function useAccount(enabled: boolean): AccountState {
  const [state, setState] = useState<AccountState>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetch("/api/me", { cache: "no-store" })
      .then(
        (r) => r.json() as Promise<{ signedIn: boolean; firstName?: string; initials?: string }>,
      )
      .then((body) => {
        if (!live) return;
        setState(
          body.signedIn
            ? {
                status: "signed-in",
                firstName: body.firstName ?? "",
                initials: body.initials ?? "",
              }
            : { status: "signed-out" },
        );
      })
      .catch(() => live && setState({ status: "signed-out" }));
    return () => {
      live = false;
    };
  }, [enabled]);
  return state;
}
