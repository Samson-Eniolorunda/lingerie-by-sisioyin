"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxRow, TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { saveSettingsAction } from "@/server/actions/admin";
import type { StoreSettings } from "@/types/account";
import { useAdminAction } from "./useAdminAction";

export function SettingsForm({ initial }: { readonly initial: StoreSettings }) {
  const [f, setF] = useState({ ...initial, lowStockThreshold: String(initial.lowStockThreshold) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAdminAction();
  const text = (
    key:
      | "announcement"
      | "whatsappNumber"
      | "supportEmail"
      | "bankName"
      | "accountNumber"
      | "accountName",
  ) => ({
    name: key,
    value: f[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [key]: e.target.value }),
    error: errors[key],
  });
  return (
    <Form
      className="flex max-w-xl flex-col gap-8"
      aria-label="Store settings"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            saveSettingsAction({
              ...f,
              lowStockThreshold: Number(f.lowStockThreshold === "" ? "NaN" : f.lowStockThreshold),
            }),
          {
            onDone: (state) => setErrors(state.ok ? {} : (state.fieldErrors ?? {})),
          },
        );
      }}
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-sans text-lg font-semibold">The shop</legend>
        <TextField
          label="Announcement bar"
          autoComplete="off"
          hint="Shown at the top of every page. Leave blank to hide it."
          optional
          {...text("announcement")}
        />
        <TextField
          label="WhatsApp number"
          inputMode="numeric"
          autoComplete="off"
          hint="Digits only, with the country code."
          {...text("whatsappNumber")}
        />
        <TextField
          label="Support email"
          type="email"
          inputMode="email"
          autoComplete="off"
          {...text("supportEmail")}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-sans text-lg font-semibold">
          Bank details shown at checkout
        </legend>
        <TextField label="Bank" autoComplete="off" {...text("bankName")} />
        <TextField
          label="Account number"
          inputMode="numeric"
          autoComplete="off"
          {...text("accountNumber")}
        />
        <TextField label="Account name" autoComplete="off" {...text("accountName")} />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-sans text-lg font-semibold">Stock and notices</legend>
        <TextField
          label="Warn when stock is at or below"
          inputMode="numeric"
          autoComplete="off"
          name="lowStockThreshold"
          value={f.lowStockThreshold}
          onChange={(e) => setF({ ...f, lowStockThreshold: e.target.value.replace(/[^\d]/g, "") })}
          error={errors.lowStockThreshold}
        />
        <CheckboxRow
          label="Tell me when a new order arrives"
          checked={f.notifyNewOrders}
          onChange={(e) => setF({ ...f, notifyNewOrders: e.target.checked })}
        />
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save settings"}
        </Button>
      </div>
    </Form>
  );
}
