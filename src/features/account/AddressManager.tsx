"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxRow, SelectField, TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { DELIVERY_STATES } from "@/lib/delivery";
import { deleteAddressAction, saveAddressAction } from "@/server/actions/account";
import type { Address } from "@/types/account";

const EMPTY = {
  label: "",
  recipient: "",
  phone: "",
  line1: "",
  city: "",
  state: "",
  isDefault: false,
};

export function AddressManager({ addresses }: { readonly addresses: readonly Address[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; values: typeof EMPTY } | null>(null);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [pending, start] = useTransition();

  const open = (address?: Address) => {
    setErrors({});
    setMessage(undefined);
    setEditing(
      address
        ? {
            id: address.id,
            values: {
              label: address.label,
              recipient: address.recipient,
              phone: address.phone,
              line1: address.line1,
              city: address.city,
              state: address.state,
              isDefault: address.isDefault,
            },
          }
        : { id: null, values: EMPTY },
    );
  };

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setEditing((e) => (e ? { ...e, values: { ...e.values, [key]: value } } : e));

  return (
    <div>
      {addresses.length === 0 ? (
        <p className="mt-4 border border-line bg-surface p-6 text-base text-muted">
          No saved addresses yet. Add one and checkout can use it.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {addresses.map((a) => (
            <li key={a.id} className="py-4">
              <p className="text-base font-medium">
                {a.label}
                {a.isDefault ? (
                  <span className="ml-2 text-sm font-normal text-primary">Default</span>
                ) : null}
              </p>
              <p className="text-base text-muted">
                {a.recipient}, {a.line1}, {a.city}, {a.state}
              </p>
              <p className="tabular text-sm text-subtle">{a.phone}</p>
              <div className="mt-1 flex gap-2">
                <Button variant="text" onClick={() => open(a)} aria-label={`Edit ${a.label}`}>
                  Edit
                </Button>
                <Button
                  variant="text"
                  onClick={() => setRemoving(a)}
                  aria-label={`Delete ${a.label}`}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex justify-end">
        <Button onClick={() => open()}>Add an address</Button>
      </div>

      <Sheet
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
        title={editing?.id ? "Edit address" : "Add an address"}
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="address-form" className="flex-1" disabled={pending}>
              {pending ? "Saving" : "Save address"}
            </Button>
          </div>
        }
      >
        {editing ? (
          <Form
            id="address-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              start(async () => {
                const result = await saveAddressAction(editing.values, editing.id);
                if (result.ok) {
                  setEditing(null);
                  toast.show(result.message ?? "Saved.", { tone: "success" });
                  router.refresh();
                } else {
                  setErrors(result.fieldErrors ?? {});
                  setMessage(result.fieldErrors ? undefined : result.message);
                }
              });
            }}
          >
            {message ? (
              <p role="alert" className="border-l-4 border-error bg-error-bg p-3 text-base">
                {message}
              </p>
            ) : null}
            <TextField
              label="Name for this address"
              hint="For example Home or Office"
              autoComplete="off"
              value={editing.values.label}
              onChange={(e) => set("label", e.target.value)}
              error={errors.label}
            />
            <TextField
              label="Recipient"
              autoComplete="name"
              autoCapitalize="words"
              value={editing.values.recipient}
              onChange={(e) => set("recipient", e.target.value)}
              error={errors.recipient}
            />
            <TextField
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={editing.values.phone}
              onChange={(e) => set("phone", e.target.value)}
              error={errors.phone}
            />
            <TextField
              label="Street address"
              autoComplete="street-address"
              value={editing.values.line1}
              onChange={(e) => set("line1", e.target.value)}
              error={errors.line1}
            />
            <TextField
              label="City or town"
              autoComplete="address-level2"
              value={editing.values.city}
              onChange={(e) => set("city", e.target.value)}
              error={errors.city}
            />
            <SelectField
              label="State"
              autoComplete="address-level1"
              value={editing.values.state}
              onChange={(e) => set("state", e.target.value)}
              error={errors.state}
            >
              <option value="">Choose a state</option>
              {DELIVERY_STATES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </SelectField>
            <CheckboxRow
              label="Use as my default address"
              checked={editing.values.isDefault}
              onChange={(e) => set("isDefault", e.target.checked)}
            />
          </Form>
        ) : null}
      </Sheet>

      <Sheet
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title="Delete this address?"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (!removing) return;
                  const result = await deleteAddressAction(removing.id);
                  setRemoving(null);
                  toast.show(result.ok ? (result.message ?? "Deleted.") : result.message, {
                    tone: result.ok ? "success" : "error",
                  });
                  router.refresh();
                })
              }
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-base text-muted">
          {removing ? `${removing.label}: ${removing.line1}, ${removing.city}` : ""}
        </p>
      </Sheet>
    </div>
  );
}
