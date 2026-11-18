"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info" | "warning";

interface ToastItem {
  readonly id: number;
  readonly message: string;
  readonly tone: Tone;
  readonly action?: { readonly label: string; readonly run: () => void };
}

interface ToastApi {
  readonly show: (
    message: string,
    options?: { tone?: Tone; action?: ToastItem["action"]; durationMs?: number },
  ) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneClass: Record<Tone, string> = {
  success: "border-success",
  error: "border-error",
  info: "border-info",
  warning: "border-warning",
};

let nextId = 1;

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [items, setItems] = useState<readonly ToastItem[]>([]);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback<ToastApi["show"]>(
    (message, options = {}) => {
      const id = nextId++;
      const item: ToastItem =
        options.action !== undefined
          ? { id, message, tone: options.tone ?? "info", action: options.action }
          : { id, message, tone: options.tone ?? "info" };
      setItems((all) => [...all.slice(-2), item]);
      window.setTimeout(() => dismiss(id), options.durationMs ?? 5000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        data-print="hide"
        className="pointer-events-none fixed inset-x-0 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4"
        style={{ bottom: "calc(var(--bottom-nav-h) + var(--safe-bottom) + 12px)" }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-md border-l-4 bg-surface px-4 py-3 text-base shadow-md",
              toneClass[item.tone],
            )}
          >
            <span>{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className="min-h-11 shrink-0 px-2 font-medium text-primary underline underline-offset-4"
                onClick={() => {
                  item.action?.run();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
