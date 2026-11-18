import type { OrderStatus } from "@/types/account";

export const CANCEL_WINDOW_MINUTES = 30;
export const RETURN_WINDOW_DAYS = 7;

interface OrderLike {
  readonly status: OrderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The status a member of staff may move an order to next. Delivered and cancelled are final. */
export const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** A customer may cancel only while the order is pending and inside the 30-minute window (D-06). */
export function cancelDeadline(order: Pick<OrderLike, "createdAt">): Date {
  return new Date(new Date(order.createdAt).getTime() + CANCEL_WINDOW_MINUTES * 60_000);
}

export function canCancelByCustomer(order: OrderLike, now: Date): boolean {
  return order.status === "pending" && now < cancelDeadline(order);
}

/** Returns and refunds are offered for seven days after delivery (D-07). */
export function canRequestReturn(order: OrderLike, now: Date): boolean {
  if (order.status !== "delivered") return false;
  const delivered = new Date(order.updatedAt).getTime();
  return now.getTime() - delivered <= RETURN_WINDOW_DAYS * 86_400_000;
}

/** The index of the last reached step in the five-step timeline; cancelled orders reach none. */
export function timelineStep(status: OrderStatus): number {
  switch (status) {
    case "pending":
    case "cancelled":
      return 0;
    case "confirmed":
      return 1;
    case "processing":
      return 2;
    case "shipped":
      return 3;
    case "delivered":
      return 4;
  }
}

export const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  pending: "Awaiting payment check",
  confirmed: "Payment confirmed",
  processing: "Being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_SHORT: Readonly<Record<OrderStatus, string>> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
