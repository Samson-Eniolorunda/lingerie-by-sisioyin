import type { Metadata } from "next";
import Link from "next/link";
import { OrderRow } from "@/features/account/OrderRow";
import { cn } from "@/lib/cn";
import { STATUS_SHORT } from "@/lib/order-rules";
import { requireCustomer } from "@/server/auth/session";
import { data } from "@/server/data";
import { ORDER_STATUSES, type OrderStatus } from "@/types/account";

export const metadata: Metadata = { title: "Your orders", robots: { index: false, follow: false } };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireCustomer("/dashboard/orders");
  const { status } = await searchParams;
  const active = ORDER_STATUSES.find((s) => s === status) as OrderStatus | undefined;
  const all = await data.account.orders(user.id);
  const orders = active ? all.filter((o) => o.status === active) : all;
  const chips: { href: string; label: string; current: boolean }[] = [
    { href: "/dashboard/orders", label: "All", current: !active },
    ...ORDER_STATUSES.map((s) => ({
      href: `/dashboard/orders?status=${s}`,
      label: STATUS_SHORT[s],
      current: active === s,
    })),
  ];
  return (
    <div>
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">Your orders</h1>
      <nav aria-label="Filter by status" className="-mx-4 mt-4 px-4">
        <ul className="flex scrollbar-none gap-2 overflow-x-auto">
          {chips.map((chip) => (
            <li key={chip.label} className="shrink-0">
              <Link
                href={chip.href}
                aria-current={chip.current ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-sm border px-4 text-base no-underline",
                  chip.current
                    ? "border-primary bg-selected text-ink"
                    : "border-control text-muted",
                )}
              >
                {chip.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {orders.length === 0 ? (
        <p className="mt-8 text-base text-muted">
          {active
            ? `No ${STATUS_SHORT[active].toLowerCase()} orders.`
            : "You have not placed an order yet."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {orders.map((order) => (
            <OrderRow key={order.orderNumber} order={order} />
          ))}
        </ul>
      )}
    </div>
  );
}
