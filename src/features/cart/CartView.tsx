"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Tag, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, SelectField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { setCheckoutChoices, useCheckoutChoices } from "@/features/checkout/session";
import { DELIVERY_STATES } from "@/lib/delivery";
import { formatNaira } from "@/lib/money";
import { computeTotals, lineTotal } from "@/lib/pricing";
import { applyPromo } from "@/server/actions/orders";
import { EditLineButton } from "@/features/product/QuickView";
import { clearCart, removeLine, restoreLine, setLineQuantity, useCart } from "./store";

const step =
  "flex size-11 items-center justify-center rounded-sm border border-control hover:bg-tint disabled:opacity-40";

export function CartView() {
  const lines = useCart();
  const choices = useCheckoutChoices();
  const toast = useToast();
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);

  const totals = computeTotals(lines, {
    promoPercent: choices.promo?.percent ?? 0,
    stateId: choices.state,
  });
  const feeKnown = choices.state !== "";

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl">Your bag is empty</h1>
        <p className="mt-3 text-base text-muted">
          Pieces you add will wait here until you are ready.
        </p>
        <ButtonLink href="/shop" className="mt-8">
          Browse the shop
        </ButtonLink>
      </div>
    );
  }

  function submitPromo(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await applyPromo(promoInput);
      if (result.ok) {
        setCheckoutChoices({ promo: { code: result.code, percent: result.percent } });
        setPromoError(undefined);
        setPromoInput("");
      } else {
        setPromoError(result.message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-[calc(var(--bar-h)+var(--safe-bottom))] sm:px-8 md:pt-10 md:pb-0">
      <Stepper steps={["Bag", "Shipping", "Payment", "Done"]} current={0} />
      <h1 className="mt-4 font-display text-[2.125rem] leading-tight md:text-5xl">Your bag</h1>

      <div className="mt-6 md:grid md:grid-cols-[1fr_22rem] md:gap-12">
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((line) => (
            <li key={line.variantId} className="flex gap-3 py-4">
              <div className="relative h-24 w-[4.5rem] shrink-0 overflow-hidden bg-tint">
                {line.image ? (
                  <Image
                    src={line.image}
                    alt=""
                    fill
                    sizes="72px"
                    unoptimized={line.image.endsWith(".svg")}
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="line-clamp-2 text-base">{line.name}</p>
                <p className="text-sm text-subtle">
                  {[line.selectedSize, line.selectedColor].filter(Boolean).join(" · ")}
                </p>
                <p className="tabular text-sm text-muted">{formatNaira(line.price_ngn)} each</p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Fewer ${line.name}`}
                      className={step}
                      disabled={line.qty <= 1}
                      onClick={() => setLineQuantity(line.variantId, line.qty - 1)}
                    >
                      <Minus size={16} strokeWidth={1.5} />
                    </button>
                    <span className="tabular w-8 text-center text-base" aria-live="polite">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`More ${line.name}`}
                      className={step}
                      onClick={() => setLineQuantity(line.variantId, line.qty + 1)}
                    >
                      <Plus size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                  <span className="tabular text-base font-medium">
                    {formatNaira(lineTotal(line))}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <EditLineButton line={line} />
                  <button
                    type="button"
                    className="min-h-11 self-start pr-2 text-sm text-muted underline underline-offset-4"
                    onClick={() => {
                      const removed = removeLine(line.variantId);
                      if (removed)
                        toast.show(`${removed.name} removed`, {
                          action: { label: "Undo", run: () => restoreLine(removed) },
                        });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside
          className="mt-8 border border-line bg-surface p-4 md:mt-0 md:self-start"
          aria-label="Order summary"
        >
          <h2 className="font-sans text-lg font-semibold">Summary</h2>

          <form onSubmit={submitPromo} className="mt-4">
            {choices.promo ? (
              <p className="flex min-h-12 items-center justify-between gap-2 bg-primary-tint px-3 text-base">
                <span className="flex items-center gap-2">
                  <Tag size={16} strokeWidth={1.5} aria-hidden="true" /> {choices.promo.code} ·{" "}
                  {choices.promo.percent}% off
                </span>
                <button
                  type="button"
                  aria-label="Remove promo code"
                  className="flex size-11 items-center justify-center"
                  onClick={() => setCheckoutChoices({ promo: null })}
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </p>
            ) : (
              <Field label="Promo code" optional error={promoError}>
                {({ id, describedBy, invalid }) => (
                  <div className="flex gap-2">
                    <input
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      type="text"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      enterKeyHint="done"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      className={`min-h-12 min-w-0 flex-1 rounded-sm border bg-surface px-3 text-base uppercase ${invalid ? "border-error" : "border-control"}`}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={pending || promoInput.trim() === ""}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </Field>
            )}
          </form>

          <SelectField
            wrapperClassName="mt-4"
            label="Delivery to"
            value={choices.state}
            onChange={(e) => setCheckoutChoices({ state: e.target.value })}
          >
            <option value="">Choose a state</option>
            {DELIVERY_STATES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} · {s.feeNgn === 0 ? "Free" : formatNaira(s.feeNgn)}
              </option>
            ))}
          </SelectField>

          <dl className="mt-5 space-y-2 text-base">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular">{formatNaira(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">Discount</dt>
                <dd className="tabular">−{formatNaira(totals.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="tabular">
                {feeKnown
                  ? totals.delivery === 0
                    ? "Free"
                    : formatNaira(totals.delivery)
                  : "Choose a state"}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatNaira(totals.total)}</dd>
            </div>
          </dl>

          <div className="mt-5 hidden sm:block">
            <ButtonLink href="/checkout" block>
              Checkout
            </ButtonLink>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link href="/shop" className="flex min-h-11 items-center text-base">
              Continue shopping
            </Link>
            <button
              type="button"
              className="min-h-11 text-base text-error underline underline-offset-4"
              onClick={() => setConfirmClear(true)}
            >
              Clear bag
            </button>
          </div>
        </aside>
      </div>

      <StickyActionBar aboveNav>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">Total</p>
            <p className="tabular text-lg font-semibold">{formatNaira(totals.total)}</p>
          </div>
          <ButtonLink href="/checkout" className="shrink-0">
            Checkout
          </ButtonLink>
        </div>
      </StickyActionBar>

      <Sheet
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear your bag?"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmClear(false)}>
              Keep my bag
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                clearCart();
                setConfirmClear(false);
              }}
            >
              Clear bag
            </Button>
          </div>
        }
      >
        <p className="text-base text-muted">
          All {lines.length} {lines.length === 1 ? "item" : "items"} will be removed from your bag.
        </p>
      </Sheet>
    </div>
  );
}
