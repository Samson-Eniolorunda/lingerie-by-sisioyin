import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/features/auth/AuthCard";
import { ResetForm } from "@/features/auth/ResetForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || token.length < 10) {
    return (
      <AuthCard
        title="This link is not valid"
        lead="Reset links work once and expire after an hour. Request a new one and try again."
      >
        <AuthLink href="/forgot-password">Request a new link</AuthLink>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password" lead="Pick something you do not use elsewhere.">
      <ResetForm token={token} />
    </AuthCard>
  );
}
