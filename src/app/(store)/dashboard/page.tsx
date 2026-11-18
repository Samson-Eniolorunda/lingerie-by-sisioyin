import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { whatsappLink } from "@/config/site";

export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

/** Holds the Account tab until sign-in and the account area are built (plan Phase 4, which needs the live Auth settings). */
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-4xl">Accounts are not open in this build</h1>
      <p className="mt-3 text-base text-muted">
        You can still follow an order with its number, or message us on WhatsApp.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <a
          href={whatsappLink("Hello, I need help with my order.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center rounded-sm border border-control px-6 text-base font-medium text-ink no-underline hover:bg-tint hover:text-ink"
        >
          Message us on WhatsApp
        </a>
        <ButtonLink href="/track">Track an order</ButtonLink>
      </div>
    </div>
  );
}
