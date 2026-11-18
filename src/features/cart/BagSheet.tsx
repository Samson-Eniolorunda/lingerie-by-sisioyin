"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { useShell } from "@/features/shell/ShellContext";
import { formatNaira } from "@/lib/money";
import { computeTotals, lineTotal } from "@/lib/pricing";
import { removeLine, restoreLine, setLineQuantity, useCart } from "./store";

const step =
  "flex size-11 items-center justify-center rounded-sm border border-control hover:bg-tint disabled:opacity-40";

/** The bag as a bottom sheet on phones and a side panel on larger screens. */
export function BagSheet() {
  const shell = useShell();
  const toast = useToast();
  const lines = useCart();
  const { subtotal } = computeTotals(lines);

  return (
    <Sheet
      open={shell.panel === "bag"}
      onOpenChange={(next) => (next ? shell.open("bag") : shell.close())}
      title="Your bag"
      className="h-[100dvh] sm:h-auto"
      footer={
        lines.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-baseline justify-between text-base">
              <span className="text-muted">Subtotal</span>
              <span className="tabular text-lg font-semibold">{formatNaira(subtotal)}</span>
            </p>
            <p className="text-sm text-subtle">Delivery is worked out at checkout.</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={shell.close}>
                Keep shopping
              </Button>
              <ButtonLink href="/cart" onClick={shell.close} className="flex-1">
                Checkout
              </ButtonLink>
            </div>
          </div>
        ) : undefined
      }
    >
      {lines.length === 0 ? (
        <div className="py-8 text-center">
          <p className="font-display text-2xl">Your bag is empty</p>
          <p className="mt-2 text-base text-muted">Pieces you add will wait here.</p>
          <ButtonLink href="/shop" onClick={shell.close} className="mt-6">
            Browse the shop
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-line">
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
            </li>
          ))}
        </ul>
      )}
      {lines.length > 0 ? (
        <p className="mt-2 text-sm text-subtle">
          <Link href="/cart" onClick={shell.close}>
            Open the full bag
          </Link>{" "}
          to add a promo code or choose a delivery state.
        </p>
      ) : null}
    </Sheet>
  );
}
