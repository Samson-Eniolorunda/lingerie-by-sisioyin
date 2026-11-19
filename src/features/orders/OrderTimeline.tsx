import { cn } from "@/lib/cn";

const STEPS = ["Placed", "Confirmed", "Processing", "Shipped", "Delivered"] as const;

/** A vertical timeline. The step reached is marked with a filled dot and the word "Current", not colour alone. */
export function OrderTimeline({
  reached,
  placedAt,
}: {
  readonly reached: number;
  readonly placedAt: string;
}) {
  const placed = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(placedAt));
  return (
    <ol className="space-y-0">
      {STEPS.map((step, index) => {
        const done = index <= reached;
        const current = index === reached;
        return (
          <li key={step} className="relative flex gap-3 pb-6 last:pb-0">
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-6 left-[0.6875rem] h-full w-px",
                  done && index < reached ? "bg-primary" : "bg-rule",
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "mt-1 size-6 shrink-0 rounded-full border-2",
                done ? "border-primary bg-primary" : "border-control bg-surface",
              )}
            />
            <div>
              <p className={cn("text-base", done ? "font-medium text-ink" : "text-subtle")}>
                {step}
                {current ? <span className="ml-2 text-sm text-primary">Current</span> : null}
              </p>
              {index === 0 ? <p className="text-sm text-subtle">{placed}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
