"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { uploadReceiptFor } from "@/features/checkout/upload-receipt";
import { formatDateTime } from "@/lib/dates";
import { prepareReceipt } from "@/lib/compress-image";
import {
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_MB,
  RECEIPT_ACCEPT,
  receiptProblem,
} from "@/lib/receipt-types";
import { attachReceipt, createReceiptReupload } from "@/server/actions/orders";

/**
 * Shown when staff rejected the receipt: the customer can send another until the deadline, after
 * which the order is cancelled and the stock released. The file goes straight to storage, as at checkout.
 */
export function ReceiptReupload({
  orderNumber,
  email,
  until,
  onDone,
}: {
  readonly orderNumber: string;
  readonly email: string;
  readonly until: string | null;
  readonly onDone?: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  async function choose(chosen: File | undefined) {
    if (!chosen) return;
    setError(undefined);
    setBusy(true);
    const prepared = await prepareReceipt(chosen, MAX_RECEIPT_BYTES);
    setBusy(false);
    const problem = prepared.ok ? receiptProblem(prepared.file) : prepared.message;
    setError(problem ?? undefined);
    setFile(prepared.ok && !problem ? prepared.file : null);
  }

  if (done)
    return (
      <p role="status" className="border-l-4 border-success bg-success-bg p-3 text-base">
        Thank you. Your new receipt is with us and will be checked shortly.
      </p>
    );

  return (
    <section aria-labelledby="reupload" className="border border-line bg-surface p-4">
      <h2 id="reupload" className="font-sans text-lg font-semibold">
        Send another receipt
      </h2>
      <p className="mt-1 text-base text-muted">
        We could not match your last receipt to the payment.
        {until
          ? ` Please send another by ${formatDateTime(until)}, or the order will be cancelled.`
          : ""}
      </p>
      <input
        ref={input}
        type="file"
        accept={RECEIPT_ACCEPT}
        className="sr-only"
        aria-label="Choose a new receipt"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <button
        type="button"
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 border border-dashed border-control bg-surface px-3 text-base text-primary"
        onClick={() => input.current?.click()}
      >
        <FileText size={18} strokeWidth={1.5} aria-hidden="true" />
        {file ? file.name : "Choose a photograph or PDF"}
      </button>
      <p className="mt-1 text-sm text-subtle">JPG, PNG, WebP or PDF, up to {MAX_RECEIPT_MB} MB.</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-error">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button
          disabled={!file || pending || busy}
          onClick={() =>
            start(async () => {
              if (!file) return;
              setError(undefined);
              const sent = await uploadReceiptFor("", file, (body) => createReceiptReupload(body), {
                order: orderNumber,
                email,
              });
              if (!sent.ok) {
                setError(sent.message);
                return;
              }
              const result = await attachReceipt({ order: orderNumber, email, path: sent.path });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setDone(true);
              onDone?.();
              router.refresh();
            })
          }
        >
          {pending ? "Sending…" : "Send receipt"}
        </Button>
      </div>
    </section>
  );
}
