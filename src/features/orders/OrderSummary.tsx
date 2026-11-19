import { formatNaira } from "@/lib/money";
import { DELIVERY_STATES } from "@/lib/delivery";
import type { StoredOrder } from "@/types/orders";

export function OrderSummary({ order }: { readonly order: StoredOrder }) {
  const state = DELIVERY_STATES.find((s) => s.id === order.state)?.label ?? order.state;
  return (
    <div className="border border-line bg-surface p-4">
      <ul className="divide-y divide-line">
        {order.lines.map((line) => (
          <li
            key={`${line.productId}-${line.size}-${line.colour}`}
            className="flex justify-between gap-3 py-3 text-base"
          >
            <span className="min-w-0">
              {line.name}
              <span className="block text-sm text-subtle">
                {[line.size, line.colour].filter(Boolean).join(" · ")} × {line.qty}
              </span>
            </span>
            <span className="tabular">{formatNaira(line.unitPriceNgn * line.qty)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-base">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular">{formatNaira(order.subtotal)}</dd>
        </div>
        {order.discount > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted">Discount{order.promoCode ? ` (${order.promoCode})` : ""}</dt>
            <dd className="tabular">−{formatNaira(order.discount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-muted">Delivery</dt>
          <dd className="tabular">{order.delivery === 0 ? "Free" : formatNaira(order.delivery)}</dd>
        </div>
        <div className="flex justify-between pt-1 text-lg font-semibold">
          <dt>Total</dt>
          <dd className="tabular">{formatNaira(order.total)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-base text-muted">
        Delivering to {order.address}, {order.city}, {state}.
      </p>
    </div>
  );
}
