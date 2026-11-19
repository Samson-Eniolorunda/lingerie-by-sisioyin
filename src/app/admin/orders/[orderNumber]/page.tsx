import { adminPath } from "@/lib/adminPath";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { OrderActions } from "@/features/admin/OrderActions";
import { PageHeader, Panel } from "@/features/admin/PageHeader";
import { OrderSummary } from "@/features/orders/OrderSummary";
import { OrderTimeline } from "@/features/orders/OrderTimeline";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { timelineStep } from "@/lib/order-rules";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";
import { receipts } from "@/server/storage/receipts";

export const metadata: Metadata = { title: "Order" };

const PAYMENT_LABEL = {
  awaiting_confirmation: "Waiting for a check",
  confirmed: "Payment confirmed",
  rejected: "Receipt rejected",
  refund_check: "Cancelled with a receipt on file: check the bank",
  refund_owed: "Refund owed to the customer",
  refunded: "Refunded",
} as const;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await requireStaff("orders.view", adminPath(`/orders/${orderNumber}`));
  const order = await data.admin.order(orderNumber);
  if (!order) notFound();
  const receipt = order.receiptPath ? await receipts.link(order.receiptPath) : null;

  return (
    <>
      <p className="mb-2">
        <Link href={adminPath("/orders")} className="inline-flex min-h-11 items-center text-sm">
          ← All orders
        </Link>
      </p>
      <PageHeader
        title={order.orderNumber}
        lead={`Placed ${formatDateTime(order.createdAt)}`}
        actions={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6 lg:order-2">
          <Panel title="Next step">
            <OrderActions
              orderNumber={order.orderNumber}
              status={order.status}
              paymentStatus={order.paymentStatus}
              canUpdate={can(user.role, "orders.update")}
              total={order.total}
              refundAmount={order.refundAmount ?? null}
            />
          </Panel>
          <Panel title="Payment receipt">
            <p className="mb-3 text-base text-muted">
              {PAYMENT_LABEL[order.paymentStatus]}
              {order.paymentStatus === "rejected" && order.receiptReuploadUntil
                ? `. The customer may send another until ${formatDateTime(order.receiptReuploadUntil)}, then the order is cancelled.`
                : ""}
            </p>
            {receipt && order.receiptPath ? (
              <figure>
                {receipt.kind === "image" ? (
                  <div className="relative mx-auto aspect-[3/4] w-full max-w-[18rem] overflow-hidden border border-line bg-tint">
                    <Image
                      src={receipt.url}
                      alt={`Receipt uploaded for order ${order.orderNumber}`}
                      fill
                      sizes="288px"
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                ) : null}
                <p className={receipt.kind === "image" ? "mt-3" : ""}>
                  <a
                    href={adminPath(
                      `/receipts/view?order=${encodeURIComponent(order.orderNumber)}&path=${encodeURIComponent(order.receiptPath)}`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center border border-control px-4 text-base font-medium no-underline hover:bg-tint"
                  >
                    Open receipt{receipt.kind === "pdf" ? " (PDF)" : ""}
                  </a>
                </p>
                <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  {order.receiptPath}
                  {receipt.mocked ? <Badge tone="warning">Placeholder</Badge> : null}
                </figcaption>
                <p className="mt-1 text-sm text-subtle">
                  Receipts are private. This link works for{" "}
                  {Math.round(receipt.expiresInSeconds / 60)} minutes.
                </p>
              </figure>
            ) : (
              <p className="text-base text-muted">No receipt was uploaded.</p>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          <Panel title="Items">
            <OrderSummary order={order} />
          </Panel>
          <Panel title="Customer and delivery">
            <dl className="grid gap-x-6 gap-y-3 text-base sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted">Name</dt>
                <dd>{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Phone</dt>
                <dd>
                  <a href={`tel:${order.phone}`}>{order.phone}</a>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Email</dt>
                <dd className="break-all">
                  <a href={`mailto:${order.email}`}>{order.email}</a>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Delivery address</dt>
                <dd>
                  {order.address}, {order.city}, {order.state}
                </dd>
              </div>
              {order.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted">Customer note</dt>
                  <dd>{order.notes}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>
          <Panel title="Progress">
            {order.status === "cancelled" ? (
              <p className="text-base text-muted">
                This order was cancelled.
                {order.paymentStatus === "refund_owed"
                  ? " The customer had paid, so a refund is owed."
                  : order.paymentStatus === "refund_check"
                    ? " A receipt was on file, so money may have arrived: a refund check is open."
                    : ""}
              </p>
            ) : (
              <OrderTimeline reached={timelineStep(order.status)} placedAt={order.createdAt} />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
