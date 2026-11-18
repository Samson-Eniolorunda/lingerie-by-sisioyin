import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A fixed bottom bar for the page's primary action. It sits inside the bottom safe area, optionally
 * above the bottom navigation, and is hidden while the on-screen keyboard is open
 * (`data-keyboard-hide`, toggled by the keyboard watcher in the shell).
 */
export function StickyActionBar({
  children,
  aboveNav,
  className,
}: {
  readonly children: ReactNode;
  readonly aboveNav?: boolean;
  readonly className?: string;
}) {
  return (
    <div
      data-keyboard-hide
      data-print="hide"
      style={aboveNav ? { bottom: "calc(var(--bottom-nav-h) + var(--safe-bottom))" } : undefined}
      className={cn(
        "fixed inset-x-0 z-[calc(var(--z-bar)+1)] border-t border-line bg-surface px-[max(var(--gutter),var(--safe-left))] pt-3 shadow-sm",
        aboveNav ? "pb-3" : "bottom-0 pb-[calc(0.75rem+var(--safe-bottom))]",
        "sm:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
