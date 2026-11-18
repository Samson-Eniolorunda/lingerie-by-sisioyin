import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FieldShellProps {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly optional?: boolean;
  readonly children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
  readonly className?: string;
}

/** Visible label above, hint and inline error below, tied to the control with aria-describedby. */
export function Field({ label, hint, error, optional, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-subtle">(optional)</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-sm text-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const control =
  "min-h-12 w-full rounded-sm border bg-surface px-3 text-base text-ink placeholder:text-subtle disabled:opacity-60";

function borderFor(invalid: boolean): string {
  return invalid ? "border-error" : "border-control";
}

type InputProps = Omit<ComponentProps<"input">, "id" | "aria-describedby" | "aria-invalid"> & {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly optional?: boolean;
  readonly wrapperClassName?: string;
};

export function TextField({
  label,
  hint,
  error,
  optional,
  wrapperClassName,
  className,
  ...rest
}: InputProps) {
  return (
    <Field
      label={label}
      hint={hint ?? ""}
      error={error}
      optional={optional ?? false}
      className={wrapperClassName ?? ""}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, borderFor(invalid), className)}
          {...rest}
        />
      )}
    </Field>
  );
}

type SelectProps = Omit<ComponentProps<"select">, "id" | "aria-describedby" | "aria-invalid"> & {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly optional?: boolean;
  readonly wrapperClassName?: string;
};

export function SelectField({
  label,
  hint,
  error,
  optional,
  wrapperClassName,
  className,
  children,
  ...rest
}: SelectProps) {
  return (
    <Field
      label={label}
      hint={hint ?? ""}
      error={error}
      optional={optional ?? false}
      className={wrapperClassName ?? ""}
    >
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, borderFor(invalid), className)}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
}

type TextareaProps = Omit<
  ComponentProps<"textarea">,
  "id" | "aria-describedby" | "aria-invalid"
> & {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly optional?: boolean;
};

export function TextareaField({ label, hint, error, optional, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint ?? ""} error={error} optional={optional ?? false}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, "min-h-32 py-3", borderFor(invalid), className)}
          {...rest}
        />
      )}
    </Field>
  );
}

/** A 44 px checkbox row whose whole width is the target. */
export function CheckboxRow({
  label,
  className,
  ...rest
}: { readonly label: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-6 shrink-0 accent-[var(--c-primary)]"
        {...rest}
      />
      <span className="text-base text-ink">{label}</span>
    </label>
  );
}
