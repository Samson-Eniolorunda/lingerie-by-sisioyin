import { adminPath } from "@/lib/adminPath";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/features/admin/PageHeader";
import { FilterBar, Pager } from "@/features/admin/Filters";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { formatDateTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { STATUS_SHORT } from "@/lib/order-rules";
import { ORDER_STATUSES, type OrderStatus } from "@/types/account";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";
import { pageFor, parsePageNumber } from "@/server/paging";

export const metadata: Metadata = { title: "Orders" };
const PER_PAGE = 10;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireStaff("orders.view", adminPath("/orders"));
  const { status, q, page } = await searchParams;
  const current = ORDER_STATUSES.find((s) => s === status) as OrderStatus | undefined;
  const pageNumber = parsePageNumber(page);
  const [byStatus, { items: shown, total }] = await Promise.all([
    data.admin.orderCounts(),
    data.admin.orders({ status: current, search: q }, pageFor(pageNumber, PER_PAGE)),
  ]);
  const counts = ORDER_STATUSES.map((s) => [s, byStatus[s]] as const);
  const all = { length: counts.reduce((n, [, count]) => n + count, 0) };

  return (
    <>
      <PageHeader title="Orders" lead="Check each receipt, then move the order along." />
      <FilterBar
        action={adminPath("/orders")}
        search={{
          name: "q",
          label: "Search orders",
          value: q ?? "",
          placeholder: "Number, name or email",
        }}
        select={{
          name: "status",
          label: "Status",
          value: current ?? "",
          options: [
            { value: "", label: `All statuses (${all.length})` },
            ...counts.map(([s, n]) => ({ value: s, label: `${STATUS_SHORT[s]} (${n})` })),
          ],
        }}
      />
      <DataTable
        caption="Orders"
        rows={shown}
        rowKey={(o) => o.orderNumber}
        empty="No orders match."
        columns={[
          {
            key: "number",
            label: "Order",
            title: true,
            cell: (o) => (
              <Link href={adminPath(`/orders/${o.orderNumber}`)} className="font-medium">
                {o.orderNumber}
              </Link>
            ),
          },
          { key: "date", label: "Placed", cell: (o) => formatDateTime(o.createdAt) },
          { key: "customer", label: "Customer", cell: (o) => o.customerName },
          {
            key: "items",
            label: "Items",
            cell: (o) => o.lines.reduce((n, l) => n + l.qty, 0),
          },
          {
            key: "total",
            label: "Total",
            align: "right",
            cell: (o) => <span className="tabular">{formatNaira(o.total)}</span>,
          },
          { key: "status", label: "Status", cell: (o) => <StatusBadge status={o.status} /> },
        ]}
      />
      <Pager
        base={adminPath("/orders")}
        params={{ status: current ?? "", q: q ?? "" }}
        page={pageNumber}
        perPage={PER_PAGE}
        total={total}
      />
    </>
  );
}
