"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { forgotAction } from "@/server/actions/auth";

export function ForgotForm({ initialEmail }: { readonly initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<{ sentTo: string; devLink?: string } | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div role="status" className="border border-line bg-surface p-4">
        <p className="text-base">
          If <strong className="font-medium">{done.sentTo}</strong> has an account, a reset link is
          on its way. It works once and expires in one hour.
        </p>
        {done.devLink ? (
          <p
            className="mt-3 border-t border-line pt-3 text-sm text-muted"
            data-testid="dev-reset-link"
          >
            Development build: no email is sent.{" "}
            <Link href={done.devLink} className="text-primary underline underline-offset-4">
              Open the reset link
            </Link>
            .
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Form
      className="flex flex-col gap-4"
      aria-label="Reset your password"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await forgotAction({ email });
          if (result.ok)
            setDone({
              sentTo: email.trim(),
              ...(result.devLink ? { devLink: result.devLink } : {}),
            });
          else setError(result.fieldErrors.email ?? result.message);
        });
      }}
    >
      <TextField
        label="Email address"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="send"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
      />
      <Button type="submit" block disabled={pending}>
        {pending ? "Sending" : "Send reset link"}
      </Button>
    </Form>
  );
}
