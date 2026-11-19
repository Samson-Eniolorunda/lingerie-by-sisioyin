import Link from "next/link";
import type { ReactNode } from "react";
import { SHOW_DEMO_HINTS } from "@/config/data-mode";
import { DEMO } from "@/server/mock/db";

/** The frame shared by the sign-in, sign-up and reset screens: a narrow column, serif title, quiet footer link. */
export function AuthCard({
  title,
  lead,
  children,
  footer,
  demo,
}: {
  readonly title: string;
  readonly lead?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly demo?: "customer" | "staff";
}) {
  return (
    <div className="mx-auto w-full max-w-[28rem] px-4 pt-8 pb-16 sm:pt-14">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">{title}</h1>
      {lead ? <p className="mt-2 text-base text-muted">{lead}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? (
        <div className="mt-6 border-t border-line pt-4 text-base text-muted">{footer}</div>
      ) : null}
      {SHOW_DEMO_HINTS && demo ? (
        <p
          className="mt-8 border border-line bg-tint p-3 text-sm text-muted"
          data-testid="demo-note"
        >
          <strong className="font-medium text-ink">Demonstration data.</strong> This build is not
          connected to the shop&apos;s database. Try{" "}
          <span className="tabular">
            {demo === "staff" ? DEMO.owner.email : DEMO.customer.email}
          </span>{" "}
          with{" "}
          <span className="tabular">
            {demo === "staff" ? DEMO.owner.password : DEMO.customer.password}
          </span>
          .
        </p>
      ) : null}
    </div>
  );
}

export function AuthLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
    >
      {children}
    </Link>
  );
}
