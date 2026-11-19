import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "text" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm text-base font-medium transition-colors duration-120 ease-out disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "min-h-12 px-6 bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-press",
  secondary: "min-h-12 px-6 border border-control bg-transparent text-ink hover:bg-tint",
  text: "min-h-11 px-2 text-primary underline underline-offset-4 hover:text-primary-hover",
  danger: "min-h-12 px-6 border border-error bg-transparent text-error hover:bg-error-bg",
};

interface CommonProps {
  readonly variant?: Variant;
  readonly block?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Button({
  variant = "primary",
  block,
  className,
  type = "button",
  ...rest
}: CommonProps & Omit<ComponentProps<"button">, keyof CommonProps>) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], block && "w-full", className)}
      {...rest}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  block,
  className,
  ...rest
}: CommonProps & Omit<ComponentProps<typeof Link>, keyof CommonProps>) {
  return <Link className={cn(base, variants[variant], block && "w-full", className)} {...rest} />;
}

/**
 * Lays out one or more buttons. A single button sits on the right. With two or more, the secondary
 * goes on the left and the primary on the right, on phones too.
 */
export function ButtonRow({
  secondary,
  primary,
  className,
}: {
  readonly secondary?: ReactNode;
  readonly primary: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        secondary ? "justify-between" : "justify-end",
        className,
      )}
    >
      {secondary ? (
        <div className="min-w-0 flex-1 sm:flex-none [&>*]:w-full sm:[&>*]:w-auto">{secondary}</div>
      ) : null}
      <div
        className={cn(
          secondary ? "min-w-0 flex-1 sm:flex-none" : "w-full sm:w-auto",
          "[&>*]:w-full sm:[&>*]:w-auto",
        )}
      >
        {primary}
      </div>
    </div>
  );
}

/** A 44 px hit area around a small icon, with an accessible name. */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: { readonly label: string; readonly children: ReactNode } & Omit<
  ComponentProps<"button">,
  "aria-label"
>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-ink hover:bg-tint",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
