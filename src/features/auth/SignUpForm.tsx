"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Turnstile, useTurnstile } from "@/components/ui/Turnstile";
import { CheckboxRow, TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { signUpAction } from "@/server/actions/auth";
import { PasswordField, PasswordRules } from "./PasswordField";

export function SignUpForm({ next }: { readonly next: string | null }) {
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const captcha = useTurnstile();

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    start(async () => {
      const result = await signUpAction(
        { ...values, acceptTerms: accepted, turnstileToken: captcha.token ?? undefined },
        next,
      );
      captcha.reset();
      if (result && !result.ok) {
        setErrors(result.fieldErrors);
        setMessage(result.message);
      }
    });
  }

  return (
    <Form onSubmit={submit} className="flex flex-col gap-4" aria-label="Create an account">
      {message ? (
        <p role="alert" className="border-l-4 border-error bg-error-bg p-3 text-base text-ink">
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          value={values.firstName}
          onChange={(e) => set("firstName")(e.target.value)}
          error={errors.firstName}
        />
        <TextField
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          autoCapitalize="words"
          enterKeyHint="next"
          value={values.lastName}
          onChange={(e) => set("lastName")(e.target.value)}
          error={errors.lastName}
        />
      </div>
      <TextField
        label="Email address"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        value={values.email}
        onChange={(e) => set("email")(e.target.value)}
        error={errors.email}
      />
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
      <div>
        <CheckboxRow
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          aria-invalid={errors.acceptTerms ? true : undefined}
          label={
            <>
              I accept the{" "}
              <Link href="/terms" className="text-primary underline underline-offset-4">
                terms
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-4">
                privacy policy
              </Link>
              .
            </>
          }
        />
        {errors.acceptTerms ? (
          <p className="text-sm font-medium text-error">{errors.acceptTerms}</p>
        ) : null}
      </div>
      <Turnstile onToken={captcha.setToken} resetSignal={captcha.resetSignal} />
      <Button type="submit" block disabled={pending || !captcha.ready}>
        {pending ? "Creating your account" : "Create account"}
      </Button>
    </Form>
  );
}
