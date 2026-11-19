"use client";

import { MessageCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { whatsappLink } from "@/config/site";
import { cn } from "@/lib/cn";

/** Pages with totals or order figures: the button would sit on them, so it is not shown. */
const HIDDEN_ON = new RegExp("^/(cart|confirmation|dashboard/orders/[^/]+)(/|$)");

/** A floating button that opens a small card with a greeting and a pre-filled message (G-10). */
export function WhatsAppButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (HIDDEN_ON.test(pathname)) return null;
  // On a product page the heart and the add button sit where the corner button would float, so on
  // wider screens it steps aside; phones keep it above the sticky add-to-bag bar.
  const onProduct = pathname.startsWith("/products/");
  return (
    <div
      className={cn("whatsapp-fab flex flex-col items-end gap-3", onProduct && "md:hidden")}
      data-print="hide"
      data-keyboard-hide
    >
      {open ? (
        <section
          aria-labelledby="whatsapp-title"
          className="w-[min(18rem,calc(100vw-2rem))] border border-line bg-surface p-4 shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 id="whatsapp-title" className="font-sans text-base font-semibold">
              Chat with us
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
              className="-mt-2 -mr-2 flex size-11 items-center justify-center text-muted"
            >
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-base text-muted">
            Ask about sizing, delivery or an order. We usually reply within a few hours.
          </p>
          <a
            href={whatsappLink("Hello, I have a question about an item on your site.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary"
          >
            Open WhatsApp
          </a>
        </section>
      ) : null}
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-label="Message us on WhatsApp"
        onClick={() => setOpen((o) => !o)}
        className="flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-md hover:bg-primary-hover"
      >
        <MessageCircle size={24} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
