import { cn } from "@/lib/cn";

/** Progress through the purchase: Cart, Shipping, Payment, Done. Fits one line at 360 px. */
export function Stepper({
  steps,
  current,
}: {
  readonly steps: readonly string[];
  readonly current: number;
}) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Progress">
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={cn("flex items-center gap-2", state === "todo" ? "text-subtle" : "text-ink")}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs font-medium",
                state === "current" && "border-primary bg-primary text-on-primary",
                state === "done" && "border-primary text-primary",
                state === "todo" && "border-control",
              )}
            >
              {state === "done" ? "✓" : index + 1}
            </span>
            <span className={cn(state === "current" ? "font-medium" : "hidden xs:inline")}>
              {step}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="h-px w-3 bg-rule xs:w-6" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
