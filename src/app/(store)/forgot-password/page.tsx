import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/features/auth/AuthCard";
import { ForgotForm } from "@/features/auth/ForgotForm";

export const metadata: Metadata = {
  title: "Forgotten password",
  robots: { index: false, follow: true },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthCard
      title="Forgotten your password?"
      lead="Enter the email address on your account and we will send a link to choose a new one."
      footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
    >
      <ForgotForm initialEmail={email?.slice(0, 120) ?? ""} />
    </AuthCard>
  );
}
