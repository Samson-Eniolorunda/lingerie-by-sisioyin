"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { PASSWORD_RULES, STRENGTH_LABELS, passwordStrength } from "@/schemas/auth";

/** A password field with a 44 px show/hide button, the right autocomplete token and an inline error. */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
  hint,
  name,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly error?: string | undefined;
  readonly autoComplete: "current-password" | "new-password";
  readonly hint?: string;
  readonly name: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} hint={hint ?? ""} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            name={name}
            type={shown ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(
              "min-h-12 w-full rounded-sm border bg-surface py-0 pr-14 pl-3 text-base text-ink",
              invalid ? "border-error" : "border-control",
            )}
          />
          <button
            type="button"
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            onClick={() => setShown((s) => !s)}
            className="absolute top-0 right-0 flex size-12 items-center justify-center text-muted hover:text-ink"
          >
            {shown ? <EyeOff size={20} strokeWidth={1.5} /> : <Eye size={20} strokeWidth={1.5} />}
          </button>
        </div>
      )}
    </Field>
  );
}

/** The five rules with a tick or a dash each, and a strength meter that is also written out. */
export function PasswordRules({ value }: { readonly value: string }) {
  const strength = passwordStrength(value);
  return (
    <div aria-live="polite" className="text-sm">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {PASSWORD_RULES.map((rule, index) => (
            <span
              key={rule.id}
              className={cn("h-1 flex-1 rounded-full", index < strength ? "bg-primary" : "bg-line")}
            />
          ))}
        </div>
        <span className="w-16 text-right text-muted">
          {value === "" ? "" : STRENGTH_LABELS[strength]}
        </span>
      </div>
      <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.id} className={met ? "text-success" : "text-muted"}>
              <span aria-hidden="true">{met ? "✓" : "–"}</span> {rule.label}
              <span className="sr-only">{met ? " (met)" : " (not met yet)"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
