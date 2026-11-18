import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Access denied" };

export default function DeniedPage() {
  return (
    <div className="mx-auto max-w-[28rem] pt-14 pb-16">
      <h1 className="font-display text-[2.125rem] leading-tight">Access denied</h1>
      <p className="mt-2 text-base text-muted">
        Your role does not include this screen. If you need it, ask the owner to change your role.
      </p>
      <div className="mt-6 flex justify-end">
        <ButtonLink href="/admin">Back to the dashboard</ButtonLink>
      </div>
      <p className="mt-6 text-sm">
        <Link href="/admin/sign-in">Sign in as someone else</Link>
      </p>
    </div>
  );
}
