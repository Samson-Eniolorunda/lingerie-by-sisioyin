import Link from "next/link";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { formatDate } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import type { StoredOrder } from "@/server/mock/orders";

/** An order is a row, not a card: number and date on the left, total and status on the right, all one tap. */
export function OrderRow({
  order,
  base = "/dashboard/orders",
}: {
  readonly order: StoredOrder;
  readonly base?: string;
}) {
  const items = order.lines.reduce((n, l) => n + l.qty, 0);
  return (
    <li>
      <Link
        href={`${base}/${order.orderNumber}`}
        className="flex min-h-16 items-center justify-between gap-3 py-3 text-ink no-underline hover:bg-tint"
      >
        <span className="min-w-0">
          <span className="tabular block text-base font-medium">{order.orderNumber}</span>
          <span className="block text-sm text-subtle">
            {formatDate(order.createdAt)} · {items} item{items === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="tabular text-base">{formatNaira(order.total)}</span>
          <StatusBadge status={order.status} />
        </span>
      </Link>
    </li>
  );
}
