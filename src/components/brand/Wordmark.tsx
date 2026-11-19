import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The wordmark set in the display face, flat, no gradient. The redrawn vector artwork replaces this
 * when the owner supplies the original logo or approves the redraw (plan 9.4).
 */
export function Wordmark({ className }: { readonly className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-11 flex-col justify-center leading-none text-ink no-underline hover:text-ink",
        className,
      )}
    >
      <span className="font-display text-[1.375rem] font-semibold tracking-[0.22em] uppercase">
        Lingeries
      </span>
      <span className="mt-0.5 font-display text-[0.8125rem] tracking-[0.18em] text-primary italic">
        by Sisioyin
      </span>
    </Link>
  );
}
