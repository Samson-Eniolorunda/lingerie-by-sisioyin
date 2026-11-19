"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import type { AdminState } from "@/server/actions/admin";

/** Runs a server action, shows its message in the toast, refreshes the page data and reports the outcome. */
export function useAdminAction() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [last, setLast] = useState<AdminState | null>(null);

  const run = useCallback(
    (
      action: () => Promise<AdminState>,
      options: {
        readonly onDone?: (state: AdminState) => void;
        /** Skip the success toast when the screen itself shows the result. */
        readonly quiet?: boolean;
        readonly undo?: { readonly label: string; readonly run: () => Promise<AdminState> };
      } = {},
    ) => {
      start(async () => {
        const state = await action();
        setLast(state);
        if (state.ok) {
          if (state.message && !options.quiet)
            toast.show(
              state.message,
              options.undo
                ? {
                    tone: "success",
                    durationMs: 7000,
                    action: {
                      label: options.undo.label,
                      run: () => {
                        void options.undo?.run().then((undone) => {
                          toast.show(undone.ok ? (undone.message ?? "Undone.") : undone.message, {
                            tone: undone.ok ? "success" : "error",
                          });
                          router.refresh();
                        });
                      },
                    },
                  }
                : { tone: "success" },
            );
          router.refresh();
        } else toast.show(state.message, { tone: "error" });
        options.onDone?.(state);
      });
    },
    [router, toast],
  );

  return { run, pending, last };
}
