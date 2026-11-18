"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { CartLine } from "@/types/domain";

// The sheet (gallery, size and colour controls, size guide) is fetched only when someone opens it, so
// the shop and bag pages do not carry that code on first load.
const QuickViewSheet = dynamic(() => import("./QuickViewSheet").then((m) => m.QuickViewSheet), {
  ssr: false,
});

function useLazyOpen() {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  return {
    open,
    used,
    setOpen: (next: boolean) => {
      if (next) setUsed(true);
      setOpen(next);
    },
  };
}

/** A 44 px button that opens the quick view. */
export function QuickViewButton({
  productId,
  name,
  className,
}: {
  readonly productId: string;
  readonly name: string;
  readonly className?: string;
}) {
  const { open, used, setOpen } = useLazyOpen();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Quick view of ${name}`}
        className={cn(
          "inline-flex min-h-11 items-center px-2 text-sm text-primary underline underline-offset-4",
          className,
        )}
      >
        Quick view
      </button>
      {used ? <QuickViewSheet productId={productId} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

export function EditLineButton({ line }: { readonly line: CartLine }) {
  const { open, used, setOpen } = useLazyOpen();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change ${line.name}`}
        className="min-h-11 pr-2 text-sm text-muted underline underline-offset-4"
      >
        Edit
      </button>
      {used ? (
        <QuickViewSheet productId={line.id} open={open} onOpenChange={setOpen} edit={line} />
      ) : null}
    </>
  );
}
