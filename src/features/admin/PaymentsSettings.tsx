"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField, TextareaField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { Panel } from "@/features/admin/PageHeader";
import { NIGERIAN_BANKS } from "@/config/banks";
import { formatDateTime } from "@/lib/dates";
import { saveBankDetailsAction, setPaymentMethodAction } from "@/server/actions/admin";
import type {
  BankDetails,
  PaymentChange,
  PaymentMethodId,
  PaymentMethodState,
} from "@/types/account";
import { useAdminAction } from "./useAdminAction";

const LABELS: Record<PaymentMethodId, string> = {
  bank_transfer: "Bank transfer",
  paystack: "Paystack",
  flutterwave: "Flutterwave",
};

function describe(change: PaymentChange): string {
  const show = (v: Record<string, unknown> | null) =>
    v
      ? Object.entries(v)
          .filter(([k]) => !["id", "method"].includes(k))
          .map(([k, val]) => `${k.replaceAll("_", " ")}: ${String(val) || "(blank)"}`)
          .join("; ")
      : "nothing";
  return `${change.entity === "bank_details" ? "Bank details" : (LABELS[change.key as PaymentMethodId] ?? change.key)}: from ${show(change.oldValue)} to ${show(change.newValue)}`;
}

function MethodRow({ state }: { readonly state: PaymentMethodState }) {
  const { run, pending } = useAdminAction();
  const alwaysOn = state.method === "bank_transfer";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="min-w-0">
        <span className="block text-base font-medium">{LABELS[state.method]}</span>
        <span className="block text-sm text-muted">
          {alwaysOn
            ? "Always on. Customers pay by transfer and send their receipt."
            : state.connected
              ? "Connected."
              : "Not connected. The developer connects it first; it cannot be switched on before then."}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <Badge tone={state.enabled ? "success" : "neutral"}>
          {state.enabled ? "On" : state.connected ? "Off" : "Not connected"}
        </Badge>
        {alwaysOn ? null : (
          <Button
            variant="secondary"
            disabled={pending || !state.connected}
            onClick={() => run(() => setPaymentMethodAction(state.method, !state.enabled))}
          >
            {state.enabled ? "Switch off" : "Switch on"}
          </Button>
        )}
      </span>
    </li>
  );
}

export function PaymentsSettings({
  bank,
  methods,
  changes,
}: {
  readonly bank: BankDetails | null;
  readonly methods: readonly PaymentMethodState[];
  readonly changes: readonly PaymentChange[];
}) {
  const [f, setF] = useState({
    bankName: bank?.bankName ?? "",
    accountNumber: bank?.accountNumber ?? "",
    accountName: bank?.accountName ?? "",
    note: bank?.note ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAdminAction();
  const banks: readonly string[] =
    f.bankName && !(NIGERIAN_BANKS as readonly string[]).includes(f.bankName)
      ? [f.bankName, ...NIGERIAN_BANKS]
      : NIGERIAN_BANKS;
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <Form
        className="flex flex-col gap-4"
        aria-label="Bank transfer details"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => saveBankDetailsAction(f), {
            onDone: (state) => setErrors(state.ok ? {} : (state.fieldErrors ?? {})),
          });
        }}
      >
        <h3 className="font-sans text-lg font-semibold">Bank transfer details</h3>
        {bank ? null : (
          <p className="border-l-4 border-warning bg-warning-bg p-3 text-base">
            No details are saved yet, so checkout says that payment details are being updated and
            customers cannot place orders. Save them below.
          </p>
        )}
        <p className="text-base text-muted">
          Customers send real money to these details and see them at checkout, in their order
          e-mail, on the tracking page, and in the terms and FAQ. Check every digit against your
          bank app before you save.
        </p>
        <SelectField
          label="Bank"
          name="bankName"
          value={f.bankName}
          error={errors.bankName}
          onChange={(e) => setF({ ...f, bankName: e.target.value })}
        >
          <option value="">Choose the bank</option>
          {banks.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Account number"
          name="accountNumber"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          hint="Ten digits."
          value={f.accountNumber}
          error={errors.accountNumber}
          onChange={(e) => setF({ ...f, accountNumber: e.target.value.replace(/[^\d]/g, "") })}
        />
        <TextField
          label="Account name"
          name="accountName"
          autoComplete="off"
          value={f.accountName}
          error={errors.accountName}
          onChange={(e) => setF({ ...f, accountName: e.target.value })}
        />
        <TextareaField
          label="Note for customers"
          name="note"
          optional
          rows={3}
          hint="Shown with the details, for example: use your order number as the reference."
          value={f.note}
          error={errors.note}
          onChange={(e) => setF({ ...f, note: e.target.value })}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save bank details"}
          </Button>
        </div>
      </Form>

      <Panel title="Payment methods">
        <ul className="divide-y divide-line">
          {methods.map((m) => (
            <MethodRow key={m.method} state={m} />
          ))}
        </ul>
      </Panel>

      <Panel title="Recent changes">
        {changes.length === 0 ? (
          <p className="text-base text-muted">Nothing has been changed yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {changes.map((c) => (
              <li key={c.id} className="py-2 text-sm">
                <span className="block text-muted">
                  {formatDateTime(c.at)} · {c.by}
                </span>
                {describe(c)}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
