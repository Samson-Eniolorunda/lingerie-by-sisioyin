import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ToastProvider } from "@/components/ui/Toast";
import { KeyboardWatcher } from "@/features/shell/KeyboardWatcher";

/** A focused flow: the wordmark and a way back to the bag, with no bottom navigation. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <header className="sticky top-0 z-[var(--z-header)] border-b border-line bg-page pt-[var(--safe-top)]">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-[max(var(--gutter),var(--safe-left))] sm:px-8">
          <Wordmark />
          <Link href="/cart" className="flex min-h-11 items-center gap-1 text-base">
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
            Back to bag
          </Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <KeyboardWatcher />
    </ToastProvider>
  );
}
