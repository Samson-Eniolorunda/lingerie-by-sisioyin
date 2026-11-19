"use client";

import { Button, ButtonRow } from "@/components/ui/Button";
import { canTransition } from "@/lib/order-rules";
import { paymentDecisionAction, setOrderStatusAction } from "@/server/actions/admin";
import type { OrderStatus, PaymentStatus } from "@/types/account";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  confirmed: { to: "processing", label: "Start preparing" },
  processing: { to: "shipped", label: "Mark as shipped" },
  shipped: { to: "delivered", label: "Mark as delivered" },
};

/**
 * One next step on the right, the cautious action on the left. While an order is pending the step is
 * the payment check: confirm the receipt, or reject it. Cancelling always asks first.
 */
export function OrderActions({
  orderNumber,
  status,
  paymentStatus,
  canUpdate,
}: {
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  readonly canUpdate: boolean;
}) {
  const { run, pending } = useAdminAction();
  if (!canUpdate)
    return <p className="text-base text-muted">Your role can view orders but not change them.</p>;
  if (status === "delivered" || status === "cancelled")
    return (
      <p className="text-base text-muted">
        This order is {status}. It is final and has no further actions.
      </p>
    );

  const cancel = canTransition(status, "cancelled") ? (
    <ConfirmButton
      label="Cancel order"
      title="Cancel this order?"
      message={
        paymentStatus === "confirmed"
          ? "The stock goes back on sale and the customer will see the order as cancelled. They have already paid, so a refund will be recorded as owed. This cannot be undone."
          : "The stock goes back on sale and the customer will see the order as cancelled. This cannot be undone."
      }
      confirmLabel="Cancel the order"
      disabled={pending}
      onConfirm={() => run(() => setOrderStatusAction(orderNumber, "cancelled"))}
    />
  ) : undefined;

  if (status === "pending")
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base text-muted">
          {paymentStatus === "awaiting_confirmation"
            ? "Check the receipt against the bank, then confirm or reject it."
            : "The last receipt was rejected. The customer can send another for 48 hours; after that the order is cancelled automatically, or you can cancel it now."}
        </p>
        <ButtonRow
          secondary={
            <Button
              variant="secondary"
              aria-label="Reject receipt"
              disabled={pending || paymentStatus !== "awaiting_confirmation"}
              onClick={() => run(() => paymentDecisionAction(orderNumber, "rejected"))}
            >
              Reject
            </Button>
          }
          primary={
            <Button
              aria-label="Confirm payment"
              disabled={pending || paymentStatus !== "awaiting_confirmation"}
              onClick={() => run(() => paymentDecisionAction(orderNumber, "confirmed"))}
            >
              Confirm
            </Button>
          }
        />
        <div className="flex justify-end">{cancel}</div>
      </div>
    );

  const next = NEXT[status];
  return (
    <ButtonRow
      secondary={cancel}
      primary={
        next ? (
          <Button
            disabled={pending}
            onClick={() => run(() => setOrderStatusAction(orderNumber, next.to))}
          >
            {next.label}
          </Button>
        ) : (
          <span />
        )
      }
    />
  );
}
