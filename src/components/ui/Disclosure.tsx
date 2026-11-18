import type { ReactNode } from "react";

/** A native disclosure row of at least 48 px, with the open state conveyed by the element itself. */
export function Disclosure({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <details className="group border-b border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-xl leading-none text-muted group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pb-4 text-base text-muted">{children}</div>
    </details>
  );
}
