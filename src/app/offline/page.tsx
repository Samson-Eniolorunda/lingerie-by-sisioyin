import type { Metadata } from "next";
import { KeyboardWatcher } from "@/features/shell/KeyboardWatcher";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "You are offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[28rem] flex-col justify-center px-4 py-16">
      <KeyboardWatcher />
      <h1 className="font-display text-[2.125rem] leading-tight">You are offline</h1>
      <p className="mt-2 text-base text-muted">
        We cannot reach the shop at the moment. Your bag is saved on this phone, so nothing is lost.
        Check your connection and try again.
      </p>
      <div className="mt-6 flex justify-end">
        <ButtonLink href="/">Try again</ButtonLink>
      </div>
    </main>
  );
}
