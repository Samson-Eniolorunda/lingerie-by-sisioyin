"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ThemeControl } from "@/features/theme/ThemeControl";
import { PasswordField } from "@/features/auth/PasswordField";
import {
  changePasswordLinkAction,
  exportDataAction,
  requestDeletionAction,
} from "@/server/actions/account";
import { signOutAction } from "@/server/actions/auth";

const heading = "font-display text-2xl";

export function SettingsPanel() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [devLink, setDevLink] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="mt-6 flex max-w-xl flex-col gap-10">
      <section aria-labelledby="appearance">
        <h2 id="appearance" className={heading}>
          Appearance
        </h2>
        <div className="mt-3">
          <ThemeControl />
        </div>
      </section>

      <section aria-labelledby="password">
        <h2 id="password" className={heading}>
          Password
        </h2>
        <p className="mt-1 text-base text-muted">We email you a link to choose a new password.</p>
        <Button
          variant="secondary"
          className="mt-3"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await changePasswordLinkAction();
              setDevLink(result.devLink);
              setLinkSent(true);
            })
          }
        >
          Send me a reset link
        </Button>
        {linkSent ? (
          <p role="status" className="mt-3 text-base text-muted">
            A reset link is on its way.{" "}
            {devLink ? (
              <>
                Development build: no email is sent.{" "}
                <Link href={devLink} className="text-primary underline underline-offset-4">
                  Open the link
                </Link>
                .
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="data">
        <h2 id="data" className={heading}>
          Your data
        </h2>
        <p className="mt-1 text-base text-muted">
          A text file with your profile, addresses and orders.
        </p>
        <Button
          variant="secondary"
          className="mt-3"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await exportDataAction();
              if (!result.ok)
                return toast.show("Sign in again to download your data.", { tone: "error" });
              const url = URL.createObjectURL(new Blob([result.text], { type: "text/plain" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = "my-data.txt";
              link.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          Download my data
        </Button>
      </section>

      <section aria-labelledby="session">
        <h2 id="session" className={heading}>
          Sign out
        </h2>
        <form action={signOutAction} className="mt-3">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </section>

      <section aria-labelledby="delete" className="border-t border-line pt-8">
        <h2 id="delete" className={heading}>
          Delete my account
        </h2>
        <p className="mt-1 text-base text-muted">
          This sends a request to delete your profile and saved addresses. Orders already placed are
          kept for our records. We confirm by email, and you can cancel the request by signing in
          again within seven days.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setDeleting(true)}>
          Request deletion
        </Button>
      </section>

      <Sheet
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete your account?"
        description="Enter your password to confirm. You will be signed out."
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleting(false)}>
              Keep my account
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await requestDeletionAction(password);
                  if (result && !result.ok)
                    setError(result.fieldErrors?.password ?? result.message);
                })
              }
            >
              {pending ? "Sending" : "Request deletion"}
            </Button>
          </div>
        }
      >
        <PasswordField
          label="Your password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={error}
        />
      </Sheet>
    </div>
  );
}
