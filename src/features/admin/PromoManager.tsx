"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonRow } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { Sheet } from "@/components/ui/Sheet";
import { formatDate } from "@/lib/dates";
import { deletePromoAction, promoActiveAction, savePromoAction } from "@/server/actions/admin";
import type { PromoRecord } from "@/types/account";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

function status(
  p: PromoRecord,
  now: number,
): { label: string; tone: "success" | "neutral" | "warning" | "error" } {
  if (!p.active) return { label: "Off", tone: "neutral" };
  if (p.expiresAt && new Date(p.expiresAt).getTime() < now)
    return { label: "Expired", tone: "error" };
  if (p.usageLimit !== null && p.usedCount >= p.usageLimit)
    return { label: "Used up", tone: "warning" };
  return { label: "Live", tone: "success" };
}

export function PromoManager({
  promos,
  canManage,
  now,
}: {
  readonly promos: readonly PromoRecord[];
  readonly canManage: boolean;
  readonly now: number;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", percent: "", expires: "", limit: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAdminAction();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    run(
      () =>
        savePromoAction({
          code: f.code,
          percent: f.percent === "" ? undefined : Number(f.percent),
          expiresAt: f.expires,
          usageLimit: f.limit === "" ? null : Number(f.limit),
        }),
      {
        onDone: (state) => {
          if (state.ok) {
            setOpen(false);
            setF({ code: "", percent: "", expires: "", limit: "" });
            setErrors({});
          } else setErrors(state.fieldErrors ?? {});
        },
      },
    );
  }

  return (
    <>
      {canManage ? (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setOpen(true)}>New promo code</Button>
        </div>
      ) : null}
      <DataTable
        caption="Promo codes"
        rows={promos}
        rowKey={(p) => p.id}
        empty="No promo codes yet."
        columns={[
          {
            key: "code",
            label: "Code",
            title: true,
            cell: (p) => <span className="tabular font-medium">{p.code}</span>,
          },
          { key: "percent", label: "Discount", cell: (p) => `${p.percent}%` },
          {
            key: "used",
            label: "Used",
            cell: (p) =>
              p.usageLimit === null ? `${p.usedCount}` : `${p.usedCount} of ${p.usageLimit}`,
          },
          {
            key: "expires",
            label: "Expires",
            cell: (p) => (p.expiresAt ? formatDate(p.expiresAt) : "Never"),
          },
          {
            key: "state",
            label: "State",
            cell: (p) => {
              const s = status(p, now);
              return <Badge tone={s.tone}>{s.label}</Badge>;
            },
          },
          {
            key: "actions",
            label: "Actions",
            actions: true,
            cell: (p) =>
              canManage ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <ConfirmButton
                    label="Delete"
                    title={`Delete ${p.code}?`}
                    message="Customers can no longer use this code. Orders that used it are not changed."
                    confirmLabel="Delete code"
                    onConfirm={() => run(() => deletePromoAction(p.id))}
                  />
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => promoActiveAction(p.id, !p.active))}
                  >
                    {p.active ? "Switch off" : "Switch on"}
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />
      <Sheet open={open} onOpenChange={setOpen} title="New promo code">
        <Form onSubmit={submit} className="flex flex-col gap-4" aria-label="New promo code">
          <TextField
            label="Code"
            name="code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
            error={errors.code}
            hint="Letters and numbers, for example WELCOME10."
          />
          <TextField
            label="Discount (%)"
            name="percent"
            inputMode="numeric"
            autoComplete="off"
            value={f.percent}
            onChange={(e) => setF({ ...f, percent: e.target.value.replace(/[^\d]/g, "") })}
            error={errors.percent}
          />
          <TextField
            label="Last day it works"
            name="expires"
            type="date"
            value={f.expires}
            onChange={(e) => setF({ ...f, expires: e.target.value })}
            error={errors.expiresAt}
            optional
          />
          <TextField
            label="Number of uses allowed"
            name="limit"
            inputMode="numeric"
            autoComplete="off"
            value={f.limit}
            onChange={(e) => setF({ ...f, limit: e.target.value.replace(/[^\d]/g, "") })}
            error={errors.usageLimit}
            optional
            hint="Leave blank for no limit."
          />
          <ButtonRow
            secondary={
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            }
            primary={
              <Button type="submit" disabled={pending}>
                {pending ? "Saving" : "Create code"}
              </Button>
            }
          />
        </Form>
      </Sheet>
    </>
  );
}
