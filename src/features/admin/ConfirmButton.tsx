"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonRow } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

/**
 * A button that asks before it acts. The cancel button sits on the left and the confirming button on
 * the right, on phones too. Destructive actions use the danger look.
 */
export function ConfirmButton({
  label,
  title,
  message,
  confirmLabel,
  onConfirm,
  tone = "danger",
  variant = "secondary",
  disabled,
  className,
}: {
  readonly label: ReactNode;
  readonly title: string;
  readonly message: ReactNode;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly tone?: "danger" | "neutral";
  readonly variant?: "primary" | "secondary" | "text" | "danger";
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant === "secondary" && tone === "danger" ? "danger" : variant}
        disabled={disabled ?? false}
        onClick={() => setOpen(true)}
        {...(className ? { className } : {})}
      >
        {label}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        footer={
          <ButtonRow
            secondary={
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            }
            primary={
              <Button
                variant={tone === "danger" ? "danger" : "primary"}
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
              >
                {confirmLabel}
              </Button>
            }
          />
        }
      >
        <div className="text-base text-muted">{message}</div>
      </Sheet>
    </>
  );
}
