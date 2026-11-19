"use client";

import { useState } from "react";
import { Button, ButtonRow } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { formatNaira } from "@/lib/money";
import { canTransition } from "@/lib/order-rules";
import {
  markRefundedAction,
  paymentDecisionAction,
  resolveRefundCheckAction,
  setOrderStatusAction,
} from "@/server/actions/admin";
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
  total,
  refundAmount,
}: {
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  readonly canUpdate: boolean;
  readonly total: number;
  readonly refundAmount: number | null;
}) {
  const { run, pending } = useAdminAction();
  const [received, setReceived] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  if (!canUpdate)
    return <p className="text-base text-muted">Your role can view orders but not change them.</p>;
  if (status === "cancelled" && paymentStatus === "refund_check")
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base text-muted">
          This order was cancelled, but the customer sent a receipt that was never accepted, so
          money may have reached the account. Check the bank statement and enter what arrived (0 if
          nothing).
        </p>
        <TextField
          label="Amount received (₦)"
          name="received"
          inputMode="numeric"
          autoComplete="off"
          hint={`The order total was ${formatNaira(total)}.`}
          value={received}
          onChange={(e) => setReceived(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
        />
        <div className="flex justify-end">
          {Number(received) > total ? (
            // More than the order total is possible (a double payment) but must be confirmed.
            <ConfirmButton
              label="Record amount"
              title="Record an overpayment?"
              message={`${formatNaira(Number(received))} is more than the order total of ${formatNaira(total)}. Confirm that this amount reached the account; all of it will be recorded as owed back to the customer.`}
              confirmLabel="Record amount"
              tone="neutral"
              variant="primary"
              disabled={pending}
              onConfirm={() =>
                run(() => resolveRefundCheckAction(orderNumber, Number(received), true))
              }
            />
          ) : (
            <Button
              disabled={pending || received === ""}
              onClick={() => run(() => resolveRefundCheckAction(orderNumber, Number(received)))}
            >
              Record amount
            </Button>
          )}
        </div>
      </div>
    );
  if (status === "cancelled" && paymentStatus === "refund_owed")
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base text-muted">
          A refund of {formatNaira(refundAmount ?? total)} is owed to the customer. Send it by bank
          transfer, then record it here.
        </p>
        <div className="flex justify-end">
          <ConfirmButton
            label="Mark refund as paid"
            title="Has the refund been paid?"
            message={`Confirm that ${formatNaira(refundAmount ?? total)} has been transferred back to the customer.`}
            confirmLabel="Refund paid"
            tone="neutral"
            variant="primary"
            disabled={pending}
            onConfirm={() => run(() => markRefundedAction(orderNumber))}
          />
        </div>
      </div>
    );
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
          : paymentStatus === "awaiting_confirmation" || paymentStatus === "rejected"
            ? "The stock goes back on sale and the customer will see the order as cancelled. A receipt is on file, so you will be asked to check the bank for money that may have arrived. This cannot be undone."
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
              onClick={() => setRejecting(true)}
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
        {cancel ? (
          // A quieter action on its own row, apart from the two main buttons.
          <div className="mt-2 flex border-t border-line pt-4">{cancel}</div>
        ) : null}
        <Sheet
          open={rejecting}
          onOpenChange={setRejecting}
          title="Reject this receipt?"
          footer={
            <ButtonRow
              secondary={
                <Button variant="secondary" onClick={() => setRejecting(false)}>
                  Cancel
                </Button>
              }
              primary={
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    setRejecting(false);
                    run(() => paymentDecisionAction(orderNumber, "rejected", reason));
                    setReason("");
                  }}
                >
                  Reject receipt
                </Button>
              }
            />
          }
        >
          <p className="mb-3 text-base text-muted">
            The customer is e-mailed and has 48 hours to send another receipt.
          </p>
          <TextField
            label="Reason (optional)"
            name="reason"
            autoComplete="off"
            maxLength={300}
            hint="Included in the e-mail to the customer and kept in the staff activity log."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Sheet>
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
