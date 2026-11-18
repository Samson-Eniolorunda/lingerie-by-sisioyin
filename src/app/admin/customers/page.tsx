import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { CustomerActions } from "@/features/admin/CustomerActions";
import { FilterBar } from "@/features/admin/Filters";
import { PageHeader } from "@/features/admin/PageHeader";
import { nowMs } from "@/lib/clock";
import { formatDate } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireStaff("customers.view", "/admin/customers");
  const { q = "" } = await searchParams;
  const [all, rows] = await Promise.all([data.admin.customers(), data.admin.customers(q)]);
  const monthAgo = (await nowMs()) - 30 * 86_400_000;
  const stats = [
    ["Customers", all.length],
    ["New in 30 days", all.filter((c) => new Date(c.createdAt).getTime() >= monthAgo).length],
    ["With orders", all.filter((c) => c.orderCount > 0).length],
  ] as const;
  return (
    <>
      <PageHeader
        title="Customers"
        lead="Spend counts delivered orders only."
        actions={
          <Link
            href="/admin/export/customers"
            className="inline-flex min-h-11 items-center text-base"
            prefetch={false}
          >
            Export CSV
          </Link>
        }
      />
      <dl className="mb-5 grid grid-cols-3 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="border border-line bg-surface p-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-display text-[1.5rem] leading-none tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <FilterBar
        action="/admin/customers"
        search={{
          name: "q",
          label: "Search customers",
          value: q,
          placeholder: "Name, email or phone",
        }}
      />
      <DataTable
        caption="Customers"
        rows={rows}
        rowKey={(c) => c.id}
        empty="No customers match."
        columns={[
          { key: "name", label: "Name", title: true, cell: (c) => c.name || c.email },
          {
            key: "email",
            label: "Email",
            cell: (c) => <span className="break-all">{c.email}</span>,
          },
          { key: "joined", label: "Joined", cell: (c) => formatDate(c.createdAt) },
          { key: "orders", label: "Orders", cell: (c) => c.orderCount },
          {
            key: "spent",
            label: "Spent",
            align: "right",
            cell: (c) => <span className="tabular">{formatNaira(c.totalSpentNgn)}</span>,
          },
          {
            key: "status",
            label: "Status",
            cell: (c) => (
              <Badge tone={c.status === "active" ? "success" : "error"}>
                {c.status === "active"
                  ? "Active"
                  : c.status === "suspended"
                    ? "Suspended"
                    : "Banned"}
              </Badge>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            actions: true,
            cell: (c) => (
              <CustomerActions
                id={c.id}
                name={c.name || c.email}
                status={c.status}
                returnPrivilege={c.returnPrivilege}
                canManage={can(user.role, "customers.manage")}
              />
            ),
          },
        ]}
      />
    </>
  );
}
