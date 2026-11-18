import type { ReactNode } from "react";

/** The title block of every admin screen: a serif heading, a plain line under it and actions on the right. */
export function PageHeader({
  title,
  lead,
  actions,
}: {
  readonly title: string;
  readonly lead?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[1.875rem] leading-tight md:text-4xl">{title}</h2>
        {lead ? <p className="mt-1 text-base text-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  readonly title?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={`min-w-0 border border-line bg-surface p-4 sm:p-5 ${className ?? ""}`}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-sans text-lg font-semibold">{title}</h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
