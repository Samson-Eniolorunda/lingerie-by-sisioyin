"use client";

import { Minus, Plus, Ruler } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { useToast } from "@/components/ui/Toast";
import { cartCount, addToCart, useCart } from "@/features/cart/store";
import { useShell } from "@/features/shell/ShellContext";
import { SizeGuideContent } from "@/features/size/SizeGuideContent";
import { WishlistHeart } from "@/features/catalogue/WishlistHeart";
import { chartForCategory } from "@/data/size-charts";
import { cn } from "@/lib/cn";
import { swatchFor } from "@/lib/colours";
import { variantIdFor } from "@/lib/cart-merge";
import { formatNaira } from "@/lib/money";
import { maxQuantity, sizeAvailable, stockNote } from "@/lib/stock";
import type { Product } from "@/types/domain";

const ONE_SIZE = "One Size";

export function PurchasePanel({ product }: { readonly product: Product }) {
  const toast = useToast();
  const shell = useShell();
  const bag = useCart();

  const sizeNames = product.sizes.map((s) => s.name);
  const needsSize = sizeNames.length > 0 && !(sizeNames.length === 1 && sizeNames[0] === ONE_SIZE);
  const needsColour = product.allowColourSelection && product.colours.length > 0;

  const [size, setSize] = useState<string | undefined>(
    sizeNames.length === 1 ? sizeNames[0] : undefined,
  );
  const [colour, setColour] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState(false);
  const [added, setAdded] = useState(false);
  const sizeGroup = useRef<HTMLFieldSetElement>(null);
  const colourGroup = useRef<HTMLFieldSetElement>(null);

  const max = useMemo(() => maxQuantity(product, { size, colour }), [product, size, colour]);
  const inBag = bag.find((l) => l.variantId === variantIdFor(product.id, size, colour))?.qty ?? 0;
  const room = Math.max(0, max - inBag);
  const outOfStock = product.qty <= 0;
  const effectiveQty = Math.min(qty, Math.max(1, room));
  const note = stockNote(max, size ? " in this size" : "");

  const status: "pick-size" | "pick-colour" | "out" | "full" | "ready" = outOfStock
    ? "out"
    : needsSize && !size
      ? "pick-size"
      : needsColour && !colour
        ? "pick-colour"
        : max <= 0
          ? "out"
          : room <= 0
            ? "full"
            : "ready";

  const label = {
    "pick-size": "Select a size",
    "pick-colour": "Select a colour",
    out: "Out of stock",
    full: "All available are in your bag",
    ready: added ? "Added" : "Add to bag",
  }[status];

  function onAdd() {
    if (status === "pick-size") {
      sizeGroup.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      sizeGroup.current?.querySelector("button")?.focus({ preventScroll: true });
      return;
    }
    if (status === "pick-colour") {
      colourGroup.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (status !== "ready") return;
    addToCart(
      {
        variantId: variantIdFor(product.id, size, colour),
        id: product.id,
        name: product.name,
        price_ngn: product.priceNgn,
        selectedSize: size ?? ONE_SIZE,
        selectedColor: colour ?? "",
        image: product.images[0]?.src ?? "",
        qty: effectiveQty,
      },
      max,
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
    toast.show(`${product.name} added to your bag`, {
      tone: "success",
      action: { label: "View bag", run: () => shell.open("bag") },
    });
  }

  const summary = [size, colour].filter(Boolean).join(" · ") || "Choose your options";
  const disabled = status === "out" || status === "full";

  return (
    <div className="flex flex-col gap-6">
      {needsSize ? (
        <fieldset ref={sizeGroup}>
          <div className="flex items-center justify-between">
            <legend className="text-base font-medium">Size{size ? `: ${size}` : ""}</legend>
            <button
              type="button"
              onClick={() => setGuide(true)}
              className="flex min-h-11 items-center gap-1.5 px-1 text-base text-primary underline underline-offset-4"
            >
              <Ruler size={18} strokeWidth={1.5} aria-hidden="true" /> Size guide
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {sizeNames.map((name) => {
              const available = sizeAvailable(product, name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={size === name}
                  aria-disabled={!available}
                  aria-label={available ? name : `${name}, unavailable`}
                  onClick={() => {
                    if (available) {
                      setSize(name);
                      setQty(1);
                    }
                  }}
                  className={cn(
                    "tabular min-h-12 min-w-12 rounded-sm border px-3 text-base",
                    size === name
                      ? "border-primary bg-primary text-on-primary"
                      : "border-control bg-surface text-ink hover:bg-tint",
                    !available &&
                      "cursor-not-allowed text-subtle line-through opacity-60 hover:bg-surface",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {needsColour ? (
        <fieldset ref={colourGroup}>
          <legend className="text-base font-medium">Colour{colour ? `: ${colour}` : ""}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {product.colours.map((c) => {
              const swatch = swatchFor(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={colour === c.name}
                  aria-label={c.name}
                  onClick={() => {
                    setColour(c.name);
                    setQty(1);
                  }}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full border",
                    colour === c.name
                      ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-page"
                      : "border-control",
                  )}
                >
                  <span
                    className="block size-7 rounded-full border border-line"
                    style={swatch ? { background: swatch } : undefined}
                  />
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : product.packType !== "Single" ? (
        <p className="text-base text-muted">
          Assorted pack ({product.packType}). Colours are chosen for you.
        </p>
      ) : null}

      <div>
        <p className="text-base font-medium">Quantity</p>
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            aria-label="Fewer"
            disabled={effectiveQty <= 1}
            onClick={() => setQty(effectiveQty - 1)}
            className="flex size-11 items-center justify-center rounded-sm border border-control disabled:opacity-40"
          >
            <Minus size={18} strokeWidth={1.5} />
          </button>
          <input
            aria-label="Quantity"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={effectiveQty}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) setQty(Math.max(1, Math.min(Math.max(1, room), n)));
            }}
            className="tabular h-11 w-14 rounded-sm border border-control bg-surface text-center text-base"
          />
          <button
            type="button"
            aria-label="More"
            disabled={effectiveQty >= room}
            onClick={() => setQty(effectiveQty + 1)}
            className="flex size-11 items-center justify-center rounded-sm border border-control disabled:opacity-40"
          >
            <Plus size={18} strokeWidth={1.5} />
          </button>
        </div>
        <p
          className={cn(
            "mt-2 text-sm",
            note.kind === "ok"
              ? "text-subtle"
              : note.kind === "low"
                ? "text-warning"
                : "text-error",
          )}
          aria-live="polite"
        >
          {outOfStock
            ? "Out of stock"
            : room < max && inBag > 0
              ? `${inBag} already in your bag. ${room} more available.`
              : note.text}
        </p>
      </div>

      <div className="hidden items-center gap-3 sm:flex">
        <Button block variant="primary" onClick={onAdd} disabled={disabled} aria-live="polite">
          {label}
        </Button>
        <WishlistHeart
          productId={product.id}
          name={product.name}
          className="border border-control"
        />
      </div>
      <div className="sm:hidden">
        <WishlistHeart productId={product.id} name={product.name} className="-ml-3" />
      </div>

      <StickyActionBar>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="tabular text-lg font-semibold">
              {formatNaira(product.priceNgn * effectiveQty)}
            </p>
            <p className="truncate text-sm text-muted">{summary}</p>
          </div>
          <Button onClick={onAdd} disabled={disabled} className="shrink-0">
            {label}
          </Button>
        </div>
      </StickyActionBar>

      <Sheet
        open={guide}
        onOpenChange={setGuide}
        title="Size guide"
        className="h-[100dvh] sm:h-auto"
      >
        <SizeGuideContent initial={chartForCategory(product.category, product.name)} showPageLink />
      </Sheet>
      <span className="sr-only" aria-live="polite">
        {cartCount(bag)} items in bag
      </span>
    </div>
  );
}
