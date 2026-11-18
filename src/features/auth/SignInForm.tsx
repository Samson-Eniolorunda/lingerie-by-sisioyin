"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { AuthLink } from "./AuthCard";
import { PasswordField } from "./PasswordField";
import { forgotLinkFor } from "./links";

interface Props {
  readonly next: string | null;
  readonly action: (
    input: unknown,
    next: string | null,
  ) => Promise<
    | { readonly ok: true }
    | { readonly ok: false; readonly message: string; readonly fieldErrors: Record<string, string> }
  >;
  readonly forgotHref: string;
  readonly emailLabel?: string;
}

/** Used by the storefront and, with the staff action, by the admin sign-in. */
export function SignInForm({ next, action, forgotHref, emailLabel = "Email address" }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    start(async () => {
      const result = await action({ email, password }, next);
      if (result && !result.ok) {
        setErrors(result.fieldErrors);
        setMessage(Object.keys(result.fieldErrors).length === 0 ? result.message : undefined);
      }
    });
  }

  return (
    <Form onSubmit={submit} className="flex flex-col gap-4" aria-label="Sign in">
      {message ? (
        <p role="alert" className="border-l-4 border-error bg-error-bg p-3 text-base text-ink">
          {message}
        </p>
      ) : null}
      <TextField
        label={emailLabel}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        error={errors.password}
      />
      <div className="-mt-2">
        <AuthLink href={forgotLinkFor(forgotHref, email)}>Forgotten your password?</AuthLink>
      </div>
      <Button type="submit" block disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </Form>
  );
}
