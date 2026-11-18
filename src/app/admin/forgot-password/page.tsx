import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/features/auth/AuthCard";
import { ForgotForm } from "@/features/auth/ForgotForm";
import { staffForgotAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Staff password reset" };

export default async function StaffForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthCard
      title="Forgotten your password?"
      lead="Enter your staff email address and we will send a link to choose a new password."
      footer={<AuthLink href="/admin/sign-in">Back to staff sign-in</AuthLink>}
    >
      <ForgotForm initialEmail={email?.slice(0, 120) ?? ""} action={staffForgotAction} />
    </AuthCard>
  );
}
