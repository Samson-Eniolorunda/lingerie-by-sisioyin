"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A 44 px copy control with a visible "Copied" confirmation. */
export function CopyButton({ value, label }: { readonly value: string; readonly label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-sm px-2 text-base text-primary"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check size={18} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Copy size={18} strokeWidth={1.5} aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
