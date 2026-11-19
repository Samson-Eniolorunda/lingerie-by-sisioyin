import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { HashRedirect } from "@/features/account/HashRedirect";
import { OrderRow } from "@/features/account/OrderRow";
import { WishlistCount } from "@/features/account/WishlistCount";
import { formatNaira } from "@/lib/money";
import { requireCustomer } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await requireCustomer("/dashboard");
  const { items: orders, total: orderCount } = await data.account.orders(
    user.id,
    {},
    { limit: 100, offset: 0 },
  );
  const spent = orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total, 0);
  return (
    <div>
      <HashRedirect />
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">
        Hello, {user.firstName}
      </h1>
      <dl className="mt-6 grid grid-cols-3 divide-x divide-line border border-line bg-surface">
        <div className="p-3 sm:p-4">
          <dt className="text-sm text-muted">Orders</dt>
          <dd className="tabular mt-1 text-xl font-semibold sm:text-2xl">{orderCount}</dd>
        </div>
        <div className="p-3 sm:p-4">
          <dt className="text-sm text-muted">Wishlist</dt>
          <dd className="tabular mt-1 text-xl font-semibold sm:text-2xl">
            <WishlistCount />
          </dd>
        </div>
        <div className="p-3 sm:p-4">
          <dt className="text-sm text-muted">Spent</dt>
          <dd className="tabular mt-1 text-xl font-semibold break-words sm:text-2xl">
            {formatNaira(spent)}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="recent" className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent" className="font-display text-2xl">
            Recent orders
          </h2>
          <Link
            href="/dashboard/orders"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          >
            All orders
          </Link>
        </div>
        {orders.length === 0 ? (
          <div className="mt-4 border border-line bg-surface p-6 text-center">
            <p className="text-base text-muted">You have not placed an order yet.</p>
            <ButtonLink href="/shop" className="mt-4">
              Browse the shop
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {orders.slice(0, 3).map((order) => (
              <OrderRow key={order.orderNumber} order={order} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
