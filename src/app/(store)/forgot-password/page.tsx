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
  searchParams: Promise<{ email?: string; link?: string }>;
}) {
  const { email, link } = await searchParams;
  return (
    <AuthCard
      title="Forgotten your password?"
      lead="Enter the email address on your account and we will send a link to choose a new one."
      footer={<AuthLink href="/sign-in">Back to sign in</AuthLink>}
    >
      {link === "expired" ? (
        <p role="alert" className="mb-4 border-l-4 border-error bg-error-bg p-3 text-base">
          That link has expired or has already been used. Request a new one below.
        </p>
      ) : null}
      <ForgotForm initialEmail={email?.slice(0, 120) ?? ""} />
    </AuthCard>
  );
}
