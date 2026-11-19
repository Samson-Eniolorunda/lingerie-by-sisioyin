import { Badge } from "@/components/ui/Badge";
import { STATUS_SHORT } from "@/lib/order-rules";
import type { OrderStatus } from "@/types/account";

const TONE = {
  pending: "warning",
  confirmed: "info",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "error",
} as const satisfies Record<OrderStatus, "warning" | "info" | "success" | "error">;

/** The status is always written out, so it never depends on colour alone. */
export function StatusBadge({ status }: { readonly status: OrderStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_SHORT[status]}</Badge>;
}
