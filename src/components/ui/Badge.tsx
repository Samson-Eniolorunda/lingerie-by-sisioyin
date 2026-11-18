import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "new";

const tones: Record<Tone, string> = {
  neutral: "bg-tint text-ink-strong",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  info: "bg-info-bg text-info",
  new: "bg-transparent text-accent",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  readonly tone?: Tone;
  readonly children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide",
        tone === "new" && "px-0 uppercase",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
