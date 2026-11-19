"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Turnstile, useTurnstile } from "@/components/ui/Turnstile";
import { TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { acceptInvitationAction } from "@/server/actions/auth";
import { PasswordField, PasswordRules } from "./PasswordField";

/** The sign-up behind a staff invitation. The e-mail address is the invitation's and cannot be changed. */
export function InviteForm({
  token,
  email,
  roleLabel,
}: {
  readonly token: string;
  readonly email: string;
  readonly roleLabel: string;
}) {
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [done, setDone] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const captcha = useTurnstile();
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    start(async () => {
      const result = await acceptInvitationAction({
        token,
        ...values,
        turnstileToken: captcha.token ?? undefined,
      });
      captcha.reset();
      if (!result) return;
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setMessage(result.message);
      } else if (result.message) setDone(result.message);
    });
  }

  if (done)
    return (
      <p role="status" className="border-l-4 border-primary bg-primary-tint p-3 text-base">
        {done}
      </p>
    );

  return (
    <Form onSubmit={submit} className="flex flex-col gap-4" aria-label="Accept your invitation">
      <p className="text-base text-muted">
        You have been invited to join the team as <strong>{roleLabel}</strong>. Choose a password to
        create your account.
      </p>
      {message ? (
        <p role="alert" className="border-l-4 border-error bg-error-bg p-3 text-base text-ink">
          {message}
        </p>
      ) : null}
      <TextField label="Email address" name="email" value={email} readOnly autoComplete="email" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          autoCapitalize="words"
          value={values.firstName}
          onChange={(e) => set("firstName")(e.target.value)}
          error={errors.firstName}
        />
        <TextField
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          autoCapitalize="words"
          value={values.lastName}
          onChange={(e) => set("lastName")(e.target.value)}
          error={errors.lastName}
        />
      </div>
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        value={values.password}
        onChange={set("password")}
        error={errors.password}
      />
      <PasswordRules value={values.password} />
      <PasswordField
        label="Confirm password"
        name="confirmPassword"
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={set("confirmPassword")}
        error={errors.confirmPassword}
      />
      <Turnstile onToken={captcha.setToken} resetSignal={captcha.resetSignal} />
      <Button type="submit" block disabled={pending || !captcha.ready}>
        {pending ? "Creating your account" : "Create my account"}
      </Button>
    </Form>
  );
}
