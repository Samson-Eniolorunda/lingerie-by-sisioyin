"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { readStorage, writeStorage } from "@/lib/storage";
import { THEME_KEY, type ThemePreference } from "@/lib/theme";

function subscribe(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener("lbs-theme", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("lbs-theme", listener);
  };
}

function readPreference(): ThemePreference {
  const value = readStorage(THEME_KEY);
  return value === "dark" || value === "system" ? value : "light";
}

export function applyTheme(preference: ThemePreference): void {
  const dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#161012" : "#FFFBFC");
}

const options = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "system", label: "System", Icon: Monitor },
  { id: "dark", label: "Dark", Icon: Moon },
] as const;

/** One theme key (`LBS_THEME`) for the whole site; light unless the visitor chose otherwise; the live site's value is read unchanged. */
export function ThemeControl({
  className,
  onFooter = false,
}: {
  readonly className?: string;
  /** Colours for the dark footer band. */
  readonly onFooter?: boolean;
}) {
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    () => "light" as ThemePreference,
  );

  const choose = useCallback((next: ThemePreference) => {
    writeStorage(THEME_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event("lbs-theme"));
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn(
        "inline-flex rounded-sm border",
        onFooter ? "border-on-footer/40" : "border-control",
        className,
      )}
    >
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={preference === id}
          onClick={() => choose(id)}
          className={cn(
            "flex min-h-11 min-w-11 items-center justify-center gap-2 px-3 text-sm",
            onFooter
              ? preference === id
                ? "bg-on-footer/20 font-medium text-on-footer"
                : "text-on-footer/80 hover:bg-on-footer/10"
              : preference === id
                ? "bg-selected font-medium text-ink"
                : "text-muted hover:bg-tint",
          )}
        >
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
