"use client";

import { useState, useTransition } from "react";
import { adminPath } from "@/lib/adminPath";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Form } from "@/components/ui/Form";
import { resetAction } from "@/server/actions/auth";
import { PasswordField, PasswordRules } from "./PasswordField";

/**
 * `staff` is for the admin's own copy of this page. `hasSession` is false when the emailed link was not exchanged for a session. It is read again after
 * the password is changed (the session ends then), so the success message is kept in local state.
 */
export function ResetForm({
  hasSession,
  staff = false,
}: {
  readonly hasSession: boolean;
  readonly staff?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [done, setDone] = useState<string | undefined>();
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="border-l-4 border-success bg-success-bg p-3 text-base">{done}</p>
        <ButtonLink href={staff ? adminPath("/sign-in") : "/sign-in"} block>
          Sign in
        </ButtonLink>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base text-muted">
          Reset links work once and expire after an hour. Request a new one and try again.
        </p>
        <ButtonLink href={staff ? adminPath("/forgot-password") : "/forgot-password"} block>
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  return (
    <Form
      className="flex flex-col gap-4"
      aria-label="Choose a new password"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(undefined);
        start(async () => {
          const result = await resetAction({ password, confirmPassword: confirm });
          if (result.ok) setDone(result.message ?? "Your password has been changed.");
          else {
            setErrors(result.fieldErrors);
            setMessage(Object.keys(result.fieldErrors).length === 0 ? result.message : undefined);
          }
        });
      }}
    >
      {message ? (
        <p role="alert" className="border-l-4 border-error bg-error-bg p-3 text-base">
          {message}
        </p>
      ) : null}
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        error={errors.password}
      />
      <PasswordRules value={password} />
      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        error={errors.confirmPassword}
      />
      <Button type="submit" block disabled={pending}>
        {pending ? "Saving" : "Set new password"}
      </Button>
    </Form>
  );
}
