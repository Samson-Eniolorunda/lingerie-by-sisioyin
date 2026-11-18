"use client";

import { useState } from "react";
import { Button, ButtonRow } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import {
  customerStatusAction,
  deleteCustomerAction,
  returnPrivilegeAction,
} from "@/server/actions/admin";
import type { UserStatus } from "@/types/account";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

export function CustomerActions({
  id,
  name,
  status,
  returnPrivilege,
  canManage,
}: {
  readonly id: string;
  readonly name: string;
  readonly status: UserStatus;
  readonly returnPrivilege: boolean;
  readonly canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { run, pending } = useAdminAction();
  if (!canManage) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} aria-label={`Manage ${name}`}>
        Manage
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={name}
        description="Changes are written to the activity log."
      >
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="font-sans text-base font-semibold">Account</h3>
            <p className="mt-1 text-base text-muted">
              {status === "active"
                ? "The account is active."
                : status === "suspended"
                  ? "The account is suspended: the customer cannot sign in."
                  : "The account is banned: the customer cannot sign in."}
            </p>
            <div className="mt-3">
              {status === "active" ? (
                <ButtonRow
                  secondary={
                    <ConfirmButton
                      label="Ban"
                      title={`Ban ${name}?`}
                      message="They are signed out and cannot return. You can reactivate the account later."
                      confirmLabel="Ban"
                      onConfirm={() => run(() => customerStatusAction(id, "banned"))}
                    />
                  }
                  primary={
                    <ConfirmButton
                      label="Suspend"
                      variant="primary"
                      tone="neutral"
                      title={`Suspend ${name}?`}
                      message="They are signed out and cannot sign in until you reactivate the account."
                      confirmLabel="Suspend"
                      onConfirm={() => run(() => customerStatusAction(id, "suspended"))}
                    />
                  }
                />
              ) : (
                <div className="flex justify-end">
                  <Button
                    disabled={pending}
                    onClick={() => run(() => customerStatusAction(id, "active"))}
                  >
                    Reactivate
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="font-sans text-base font-semibold">Returns</h3>
            <p className="mt-1 text-base text-muted">
              {returnPrivilege
                ? "The customer may request returns."
                : "Returns are switched off for this customer."}
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => returnPrivilegeAction(id, !returnPrivilege))}
              >
                {returnPrivilege ? "Revoke returns" : "Restore returns"}
              </Button>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="font-sans text-base font-semibold text-error">
              Delete this customer&rsquo;s data
            </h3>
            <p className="mt-1 text-base text-muted">
              Removes the profile, addresses and wishlist. Orders are kept without the link to the
              account. This cannot be undone.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <TextField
                label="Type DELETE to confirm"
                name="confirm-delete"
                autoComplete="off"
                autoCapitalize="characters"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
              <div className="flex justify-end">
                <ConfirmButton
                  label="Delete data"
                  disabled={typed.trim() !== "DELETE"}
                  title={`Delete all data for ${name}?`}
                  message="This is the second confirmation. Nothing can be recovered."
                  confirmLabel="Delete for good"
                  onConfirm={() => {
                    setOpen(false);
                    run(() => deleteCustomerAction(id));
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      </Sheet>
    </>
  );
}
