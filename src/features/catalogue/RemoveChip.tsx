import Link from "next/link";
import { X } from "lucide-react";

export function RemoveChip({ href, label }: { readonly href: string; readonly label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 shrink-0 items-center gap-2 rounded-sm bg-selected px-3 text-sm text-ink no-underline hover:text-ink"
    >
      {label}
      <X size={16} strokeWidth={1.5} aria-label="Remove filter" />
    </Link>
  );
}
