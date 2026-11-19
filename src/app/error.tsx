"use client";

import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-4xl">Something went wrong</h1>
      <p className="mt-3 text-base text-muted">
        We could not load this page. Try again, and if it keeps happening, message us on WhatsApp.
      </p>
      <div className="mt-8 flex justify-center">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
