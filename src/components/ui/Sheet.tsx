"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";

type Side = "bottom" | "left" | "right";

interface SheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly side?: Side;
  readonly children: ReactNode;
  /** Pinned below the scrolling body, inside the bottom inset. */
  readonly footer?: ReactNode;
  readonly className?: string;
}

const placement: Record<Side, string> = {
  bottom:
    "inset-x-0 bottom-0 max-h-[100dvh] rounded-t-lg sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:max-h-[85dvh]",
  left: "inset-y-0 left-0 w-[min(88vw,22rem)]",
  right: "inset-y-0 right-0 w-[min(100vw,26rem)]",
};

/**
 * One accessible primitive for sheets, drawers and dialogs. Radix supplies the focus trap, inert
 * background, Escape handling and focus return; on a phone the bottom variant also closes by
 * dragging the handle downwards.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  side = "bottom",
  children,
  footer,
  className,
}: SheetProps) {
  const startY = useRef<number | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (startY.current !== null && event.clientY - startY.current > 80) onOpenChange(false);
    startY.current = null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-sheet)] bg-overlay" />
        <Dialog.Content
          className={cn(
            "fixed z-[calc(var(--z-sheet)+1)] flex flex-col bg-surface text-ink shadow-lg outline-none",
            placement[side],
            className,
          )}
        >
          {side === "bottom" ? (
            <div
              className="flex h-5 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              aria-hidden="true"
            >
              <span className="h-1 w-10 rounded-full bg-rule" />
            </div>
          ) : null}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 pt-1 pb-2 sm:pt-3">
            <Dialog.Title className="font-sans text-xl font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close" className="-mr-2">
                <X size={20} strokeWidth={1.5} />
              </IconButton>
            </Dialog.Close>
          </header>
          {description ? (
            <Dialog.Description className="px-4 pt-3 text-sm text-muted">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {children}
          </div>
          {footer ? (
            <footer className="shrink-0 border-t border-line px-4 pt-3 pb-[calc(0.75rem+var(--safe-bottom))]">
              {footer}
            </footer>
          ) : (
            <div className="shrink-0 pb-[var(--safe-bottom)]" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
