import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, Panel } from "@/features/admin/PageHeader";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Dashboard" };

function Figure({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-[1.75rem] leading-none [overflow-wrap:anywhere] lining-nums tabular-nums">
        {value}
      </p>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="block border border-line bg-surface p-4 text-ink no-underline hover:bg-tint"
    >
      {body}
    </Link>
  ) : (
    <div className="min-w-0 border border-line bg-surface p-4">{body}</div>
  );
}

export default async function AdminDashboard() {
  const user = await requireStaff(null, "/admin");
  const [summary, settings] = await Promise.all([data.admin.summary(), data.admin.settings()]);
  const low = summary.lowStock.filter((p) => p.qty <= Math.max(settings.lowStockThreshold, 9));
  return (
    <>
      <PageHeader
        title={`Good day, ${user.firstName || "there"}`}
        lead="What needs you today."
        actions={<ButtonLink href="/admin/products/new">Add a product</ButtonLink>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure
          label="Orders to check"
          value={String(summary.pendingOrders)}
          href="/admin/orders?status=pending"
        />
        <Figure
          label="Unread messages"
          value={String(summary.unreadMessages)}
          href="/admin/messages"
        />
        <Figure label="Products" value={String(summary.productCount)} href="/admin/products" />
        <Figure label="Revenue, delivered orders" value={formatNaira(summary.revenueNgn)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Latest orders"
          action={
            can(user.role, "orders.view") ? (
              <Link href="/admin/orders" className="inline-flex min-h-11 items-center text-sm">
                View all
              </Link>
            ) : null
          }
        >
          {summary.recentOrders.length === 0 ? (
            <p className="text-base text-muted">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {summary.recentOrders.map((o) => (
                <li key={o.orderNumber}>
                  <Link
                    href={`/admin/orders/${o.orderNumber}`}
                    className="flex min-h-14 items-center justify-between gap-3 py-2 text-ink no-underline"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium">{o.customerName}</span>
                      <span className="block text-sm text-muted">
                        {o.orderNumber} · {formatDateTime(o.createdAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="tabular text-base">{formatNaira(o.total)}</span>
                      <StatusBadge status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Running low"
          action={
            can(user.role, "products.manage") ? (
              <Link
                href="/admin/products?stock=low"
                className="inline-flex min-h-11 items-center text-sm"
              >
                View all
              </Link>
            ) : null
          }
        >
          {low.length === 0 ? (
            <p className="text-base text-muted">Every product is well stocked.</p>
          ) : (
            <ul className="divide-y divide-line">
              {low.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 py-2 text-ink no-underline"
                  >
                    <span className="min-w-0 truncate text-base">{p.name}</span>
                    <span className="tabular shrink-0 text-base font-medium text-warning">
                      {p.qty === 0 ? "Out of stock" : `${p.qty} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
