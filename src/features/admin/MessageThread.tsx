"use client";

import { useEffect, useState } from "react";
import { Button, ButtonRow } from "@/components/ui/Button";
import { TextareaField } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { deleteMessageAction, markMessageAction, replyAction } from "@/server/actions/admin";
import { ConfirmButton } from "./ConfirmButton";
import { useAdminAction } from "./useAdminAction";

/** Marks the message read when it is opened, then offers the reply, "mark as unread" and delete. */
export function MessageActions({
  id,
  status,
  canManage,
}: {
  readonly id: string;
  readonly status: "unread" | "read" | "replied";
  readonly canManage: boolean;
}) {
  const { run, pending } = useAdminAction();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (canManage && status === "unread") void markMessageAction(id, "read");
  }, [id, status, canManage]);

  if (!canManage) return null;
  return (
    <div className="mt-6 flex flex-col gap-5">
      <Form
        className="flex flex-col gap-3"
        aria-label="Reply"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => replyAction(id, { body }), {
            onDone: (state) => {
              if (state.ok) {
                setBody("");
                setError(undefined);
              } else setError(state.fieldErrors?.body ?? state.message);
            },
          });
        }}
      >
        <TextareaField
          label="Your reply"
          name="reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          error={error}
          hint="The reply is saved with the message. Sending it by email is not connected yet."
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save reply"}
          </Button>
        </div>
      </Form>
      <ButtonRow
        secondary={
          <ConfirmButton
            label="Delete"
            title="Delete this message?"
            message="The message and its replies are removed for good."
            confirmLabel="Delete message"
            onConfirm={() => run(() => deleteMessageAction(id))}
          />
        }
        primary={
          <Button
            variant="secondary"
            disabled={pending || status === "unread"}
            onClick={() => run(() => markMessageAction(id, "unread"))}
          >
            Mark as unread
          </Button>
        }
      />
    </div>
  );
}
