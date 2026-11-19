"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cancelOrderAction } from "@/server/actions/account";

/** Shows the time left in the 30-minute window and cancels after a confirmation. */
export function CancelOrder({
  orderNumber,
  deadlineIso,
}: {
  readonly orderNumber: string;
  readonly deadlineIso: string;
}) {
  const deadline = new Date(deadlineIso).getTime();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();

  const now = useNow();
  if (now === 0) return null;
  const left = Math.max(0, deadline - now);
  if (left === 0)
    return <p className="text-sm text-muted">The 30-minute window for cancelling has passed.</p>;

  const minutes = Math.floor(left / 60_000);
  const seconds = String(Math.floor((left % 60_000) / 1000)).padStart(2, "0");

  return (
    <div>
      <p className="text-sm text-muted">
        You can cancel for another{" "}
        <span className="tabular font-medium text-ink">
          {minutes}:{seconds}
        </span>
        .
      </p>
      <Button variant="danger" className="mt-2" onClick={() => setOpen(true)}>
        Cancel this order
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Cancel this order?"
        description="The pieces go back on the shelf. Nothing is charged until we confirm your payment."
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Keep my order
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await cancelOrderAction(orderNumber);
                  if (result.ok) {
                    setOpen(false);
                    toast.show(result.message ?? "Order cancelled.", { tone: "success" });
                    router.refresh();
                  } else setError(result.message);
                })
              }
            >
              {pending ? "Cancelling" : "Cancel order"}
            </Button>
          </div>
        }
      >
        {error ? (
          <p role="alert" className="text-base font-medium text-error">
            {error}
          </p>
        ) : (
          <p className="text-base text-muted">
            Order <span className="tabular">{orderNumber}</span> will be cancelled.
          </p>
        )}
      </Sheet>
    </div>
  );
}
