import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptReupload } from "@/features/orders/ReceiptReupload";
import { CancelOrder } from "@/features/account/CancelOrder";
import { OrderSummary } from "@/features/orders/OrderSummary";
import { OrderTimeline } from "@/features/orders/OrderTimeline";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { whatsappLink } from "@/config/site";
import {
  STATUS_LABELS,
  cancelDeadline,
  canCancelByCustomer,
  canRequestReturn,
  timelineStep,
} from "@/lib/order-rules";
import { ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import { requireCustomer } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await requireCustomer(`/dashboard/orders/${orderNumber}`);
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();
  const order = await data.account.order(user.id, orderNumber);
  if (!order) notFound();
  const now = new Date();
  return (
    <div>
      <Link
        href="/dashboard/orders"
        className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
      >
        All orders
      </Link>
      <h1 className="mt-1 font-display text-[2rem] leading-tight md:text-4xl">
        Order <span className="tabular">{order.orderNumber}</span>
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-base">
        <StatusBadge status={order.status} />
        <span className="text-muted">{STATUS_LABELS[order.status]}</span>
      </p>

      {order.status === "cancelled" ? (
        <p className="mt-6 border-l-4 border-error bg-error-bg p-3 text-base">
          This order was cancelled.
        </p>
      ) : (
        <section aria-labelledby="progress" className="mt-8">
          <h2 id="progress" className="font-sans text-lg font-semibold">
            Progress
          </h2>
          <div className="mt-3">
            <OrderTimeline reached={timelineStep(order.status)} placedAt={order.createdAt} />
          </div>
        </section>
      )}

      <section aria-labelledby="items" className="mt-8">
        <h2 id="items" className="mb-3 font-sans text-lg font-semibold">
          Items and delivery
        </h2>
        <OrderSummary order={order} />
      </section>

      <div className="mt-8 flex flex-col gap-3">
        {order.status === "pending" && order.paymentStatus === "rejected" ? (
          <ReceiptReupload
            orderNumber={order.orderNumber}
            email={order.email}
            until={order.receiptReuploadUntil}
          />
        ) : null}
        {order.paymentStatus === "refund_check" ? (
          <p className="border-l-4 border-primary bg-primary-tint p-3 text-base">
            This order was cancelled. If you sent a transfer, we are checking our account and will
            refund whatever reached us. We will be in touch.
          </p>
        ) : null}
        {order.paymentStatus === "refund_owed" ? (
          <p className="border-l-4 border-primary bg-primary-tint p-3 text-base">
            You had paid for this order, so we owe you a refund. We will be in touch to arrange it.
          </p>
        ) : null}
        {canCancelByCustomer(order, now) ? (
          <CancelOrder
            orderNumber={order.orderNumber}
            deadlineIso={cancelDeadline(order).toISOString()}
          />
        ) : null}
        {canRequestReturn(order, now) ? (
          <p className="text-base text-muted">
            Need to return something? You have seven days from delivery.{" "}
            <a
              href={whatsappLink(
                `Hello, I would like to return an item from order ${order.orderNumber}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              Message us on WhatsApp
            </a>{" "}
            or{" "}
            <Link
              href={`/contact?subject=returns&order=${order.orderNumber}`}
              className="text-primary underline underline-offset-4"
            >
              use the contact form
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
