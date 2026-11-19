"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { whatsappLink } from "@/config/site";
import { trackOrder, type TrackState } from "@/server/actions/orders";
import { timelineStep } from "@/lib/order-rules";
import { ReceiptReupload } from "./ReceiptReupload";
import { OrderSummary } from "./OrderSummary";
import { StatusBadge } from "./StatusBadge";
import { OrderTimeline } from "./OrderTimeline";

export function TrackForm({ initialOrder }: { readonly initialOrder: string }) {
  const [order, setOrder] = useState(initialOrder);
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<TrackState | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await trackOrder({ order, email })));
        }}
      >
        <TextField
          label="Order number"
          name="order"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          hint="Looks like LBS-18112026-0001"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        />
        <TextField
          label="Email used for the order"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" block disabled={pending}>
          {pending ? "Looking…" : "Track order"}
        </Button>
      </form>

      <div aria-live="polite" className="mt-8">
        {result && !result.ok ? (
          <p className="text-base text-muted">
            {result.message}{" "}
            <a
              href={whatsappLink("Hello, I need help finding my order.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              Message us on WhatsApp
            </a>{" "}
            if you need a hand.
          </p>
        ) : null}
        {result?.ok ? (
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-3 text-base">
              <span className="tabular font-semibold">{result.order.orderNumber}</span>
              <StatusBadge status={result.order.status} />
            </p>
            <OrderTimeline
              reached={timelineStep(result.order.status)}
              placedAt={result.order.createdAt}
            />
            <OrderSummary order={result.order} />
            {result.bank ? (
              <section aria-labelledby="pay-heading" className="border border-line bg-surface p-4">
                <h3 id="pay-heading" className="font-sans text-lg font-semibold">
                  Where the payment goes
                </h3>
                <dl className="mt-2 space-y-1 text-base">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Bank</dt>
                    <dd>{result.bank.bankName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Account number</dt>
                    <dd className="tabular">{result.bank.accountNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted">Account name</dt>
                    <dd className="text-right">{result.bank.accountName}</dd>
                  </div>
                </dl>
                {result.bank.note ? <p className="mt-2 text-base">{result.bank.note}</p> : null}
              </section>
            ) : null}
            {result.order.status === "pending" && result.order.paymentStatus === "rejected" ? (
              <ReceiptReupload
                orderNumber={result.order.orderNumber}
                email={email}
                until={result.order.receiptReuploadUntil}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
