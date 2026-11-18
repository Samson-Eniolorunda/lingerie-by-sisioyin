"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonRow } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SelectField, TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { Sheet } from "@/components/ui/Sheet";
import { formatDate } from "@/lib/dates";
import { isProtectedRole, ROLE_LABELS } from "@/lib/permissions";
import { inviteStaffAction, removeStaffAction, setStaffRoleAction } from "@/server/actions/admin";
import type { StaffMember } from "@/types/account";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

export function TeamManager({
  staff,
  selfId,
}: {
  readonly staff: readonly StaffMember[];
  readonly selfId: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "super_admin">("editor");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [link, setLink] = useState<string | null>(null);
  const { run, pending } = useAdminAction();

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setLink(null);
            setOpen(true);
          }}
        >
          Invite someone
        </Button>
      </div>
      <DataTable
        caption="Staff"
        rows={staff}
        rowKey={(s) => s.id}
        empty="No staff yet."
        columns={[
          {
            key: "name",
            label: "Name",
            title: true,
            cell: (s) => (
              <>
                {s.name || s.email}
                {s.id === selfId ? (
                  <span className="ml-2 text-sm font-normal text-muted">(you)</span>
                ) : null}
              </>
            ),
          },
          {
            key: "email",
            label: "Email",
            cell: (s) => <span className="break-all">{s.email}</span>,
          },
          {
            key: "role",
            label: "Role",
            cell: (s) => (
              <Badge tone={isProtectedRole(s.role) ? "info" : "neutral"}>
                {ROLE_LABELS[s.role]}
              </Badge>
            ),
          },
          { key: "since", label: "Since", cell: (s) => formatDate(s.createdAt) },
          {
            key: "actions",
            label: "Actions",
            actions: true,
            cell: (s) => {
              if (isProtectedRole(s.role))
                return <span className="text-sm text-muted">Protected</span>;
              if (s.id === selfId) return null;
              const promote = s.role === "editor";
              return (
                <div className="flex flex-wrap justify-end gap-2">
                  <ConfirmButton
                    label="Remove"
                    title={`Remove ${s.name || s.email}?`}
                    message="They lose access to the admin at once and are signed out."
                    confirmLabel="Remove access"
                    onConfirm={() => run(() => removeStaffAction(s.id))}
                  />
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(() => setStaffRoleAction(s.id, promote ? "super_admin" : "editor"))
                    }
                  >
                    {promote ? "Make super admin" : "Make editor"}
                  </Button>
                </div>
              );
            },
          },
        ]}
      />
      <p className="mt-4 text-sm text-muted">
        An editor adds and edits products, works orders and answers messages. A super admin can do
        everything an owner can, except change an owner.
      </p>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Invite a member of staff"
        description="The invitation lasts seven days. Inviting the same address again replaces the earlier one."
      >
        {link ? (
          <div className="flex flex-col gap-4" role="status">
            <p className="text-base">
              Send this link to the new member of staff. Email delivery is not connected yet.
            </p>
            <p
              className="tabular border border-line bg-tint p-3 text-sm break-all"
              data-testid="invite-link"
            >
              {link}
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <Form
            className="flex flex-col gap-4"
            aria-label="Invite"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => inviteStaffAction({ email, role }), {
                onDone: (state) => {
                  if (state.ok) {
                    setLink(state.link ?? null);
                    setEmail("");
                    setErrors({});
                  } else setErrors(state.fieldErrors ?? {});
                },
              });
            }}
          >
            <TextField
              label="Email address"
              name="invite-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <SelectField
              label="Role"
              name="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value === "super_admin" ? "super_admin" : "editor")}
            >
              <option value="editor">Editor: can add and edit products</option>
              <option value="super_admin">Super admin: full access</option>
            </SelectField>
            <ButtonRow
              secondary={
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              }
              primary={
                <Button type="submit" disabled={pending}>
                  {pending ? "Creating" : "Create invitation"}
                </Button>
              }
            />
          </Form>
        )}
      </Sheet>
    </>
  );
}
