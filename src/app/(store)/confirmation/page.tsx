import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { whatsappLink } from "@/config/site";
import { OrderSummary } from "@/features/orders/OrderSummary";
import { CopyButton } from "@/features/checkout/CopyButton";
import { lastOrder } from "@/server/actions/orders";

export const metadata: Metadata = {
  title: "Order placed",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage() {
  const order = await lastOrder();
  if (!order) redirect("/shop");
  return (
    <div className="mx-auto max-w-[560px] px-4 py-10 sm:py-16">
      <h1 className="font-display text-4xl md:text-5xl">Thank you</h1>
      <p className="mt-2 text-base text-muted">Your order is in. Your order number is</p>
      <p className="tabular mt-1 text-3xl font-semibold tracking-wide">{order.orderNumber}</p>
      <CopyButton value={order.orderNumber} label="order number" />
      <ol className="mt-6 space-y-2 text-base">
        <li>1. A person checks your payment against your receipt.</li>
        <li>2. We confirm your order by email to {order.email}.</li>
        <li>3. We prepare and send your order, and you can follow it with this number.</li>
      </ol>
      <div className="mt-8">
        <OrderSummary order={order} />
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <ButtonLink href={`/track?order=${order.orderNumber}`} block className="sm:w-auto">
          Track this order
        </ButtonLink>
        <a
          href={whatsappLink(`Hello, I have just placed order ${order.orderNumber}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center rounded-sm border border-control px-6 text-base font-medium text-ink no-underline hover:bg-tint hover:text-ink sm:w-auto"
        >
          Message us on WhatsApp
        </a>
      </div>
    </div>
  );
}
