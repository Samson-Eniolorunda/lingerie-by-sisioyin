"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { googleAction } from "@/server/actions/auth";

/** Google's own multicolour mark is not part of the icon set; the button is plain text with a clear label. */
export function GoogleButton({ label }: { readonly label: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  return (
    <div>
      <Button
        variant="secondary"
        block
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await googleAction();
            setMessage(result.ok ? undefined : result.message);
          })
        }
      >
        {label}
      </Button>
      {message ? (
        <p role="alert" className="mt-2 text-sm text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-sm text-subtle" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
