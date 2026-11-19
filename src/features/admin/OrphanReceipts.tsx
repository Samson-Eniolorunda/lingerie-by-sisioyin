"use client";

import { adminPath } from "@/lib/adminPath";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Panel } from "@/features/admin/PageHeader";
import { formatDateTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { closeCheckoutFailureAction, deleteOrphanReceiptAction } from "@/server/actions/admin";
import type { OrphanReceipt } from "@/types/orders";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

type Item = OrphanReceipt;

function ViewLink({ path, viewed }: { readonly path: string; readonly viewed: boolean }) {
  return (
    <p className="mt-3 text-base">
      <a
        href={adminPath(`/receipts/view?path=${encodeURIComponent(path)}`)}
        target="_blank"
        rel="noopener noreferrer"
      >
        View receipt
      </a>{" "}
      <span className="text-sm text-subtle">
        ({viewed ? "opened by staff; " : "not yet opened; "}a private link that expires after five
        minutes)
      </span>
    </p>
  );
}

function ContactLine({ item }: { readonly item: Item }) {
  return (
    <p className="text-base break-all">
      {item.customerName || "Name not given"}
      {" · "}
      {item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : "no e-mail"}
      {" · "}
      {item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : "no phone"}
    </p>
  );
}

function Failure({ item, canUpdate }: { readonly item: Item; readonly canUpdate: boolean }) {
  const { run, pending } = useAdminAction();
  const [note, setNote] = useState("");
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">{item.customerName || "Unknown customer"}</p>
          <p className="text-base break-all">
            {item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : null}
            {item.phone ? (
              <>
                {" · "}
                <a href={`tel:${item.phone}`}>{item.phone}</a>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatDateTime(item.uploadedAt)}
            {item.quotedTotal !== null ? ` · ${formatNaira(item.quotedTotal)} quoted` : ""}
          </p>
          {item.reason ? <p className="mt-1 text-sm text-muted">Reason: {item.reason}</p> : null}
        </div>
        <Badge tone={item.resolved ? "neutral" : "warning"}>
          {item.resolved ? "Closed" : "Open"}
        </Badge>
      </div>
      <ViewLink path={item.path} viewed={item.viewed} />
      {canUpdate && !item.resolved && item.failureId ? (
        <div className="mt-4 flex flex-col gap-3">
          <TextField
            label="What was done (optional)"
            name="note"
            autoComplete="off"
            hint="For example: refunded in full on 12 March."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              disabled={pending}
              onClick={() => run(() => closeCheckoutFailureAction(item.failureId ?? "", note))}
            >
              Close this item
            </Button>
          </div>
        </div>
      ) : null}
      {canUpdate && item.resolved && item.viewed ? (
        <div className="mt-4 flex justify-end">
          <ConfirmButton
            label="Delete the receipt"
            title="Delete this receipt?"
            message="The file is removed from private storage. Do this only once the customer has been refunded or helped."
            confirmLabel="Delete"
            disabled={pending}
            onConfirm={() => run(() => deleteOrphanReceiptAction(item.path))}
          />
        </div>
      ) : null}
    </Panel>
  );
}

export function OrphanReceipts({
  items,
  canUpdate,
}: {
  readonly items: readonly Item[];
  readonly canUpdate: boolean;
}) {
  const { run, pending } = useAdminAction();
  const failures = items.filter((i) => i.failureId);
  const abandoned = items.filter((i) => !i.failureId);
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="failed-heading" className="flex flex-col gap-3">
        <h3 id="failed-heading" className="font-sans text-lg font-semibold">
          Paid, but the order failed ({failures.filter((f) => !f.resolved).length} open)
        </h3>
        {failures.length === 0 ? (
          <p className="text-base text-muted">None. Every receipt belongs to an order.</p>
        ) : (
          failures.map((f) => <Failure key={f.path} item={f} canUpdate={canUpdate} />)
        )}
      </section>
      <section aria-labelledby="abandoned-heading" className="flex flex-col gap-3">
        <h3 id="abandoned-heading" className="font-sans text-lg font-semibold">
          Abandoned uploads ({abandoned.length})
        </h3>
        <p className="text-base text-muted">
          Files uploaded at checkout where the customer never placed an order. Safe to delete once
          they are more than a day old.
        </p>
        {abandoned.length === 0 ? (
          <p className="text-base text-muted">None.</p>
        ) : (
          <ul className="divide-y divide-line border border-line bg-surface">
            {abandoned.map((a) => (
              <li key={a.path} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span className="min-w-0 text-sm break-all">
                  <ContactLine item={a} />
                  <span className="block text-subtle">{formatDateTime(a.uploadedAt)}</span>
                  <ViewLink path={a.path} viewed={a.viewed} />
                </span>
                {canUpdate && a.viewed ? (
                  <ConfirmButton
                    label="Delete"
                    title="Delete this upload?"
                    message="The file is removed from private storage."
                    confirmLabel="Delete"
                    disabled={pending}
                    onConfirm={() => run(() => deleteOrphanReceiptAction(a.path))}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
