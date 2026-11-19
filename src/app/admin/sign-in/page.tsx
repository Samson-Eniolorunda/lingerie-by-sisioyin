import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/features/auth/AuthCard";
import { SignInForm } from "@/features/auth/SignInForm";
import { safeNext } from "@/lib/safe-next";
import { staffSignInAction } from "@/server/actions/auth";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Staff sign-in" };

export default async function StaffSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await currentUser("staff")) redirect(safeNext(next, "/admin"));
  return (
    <AuthCard
      title="Staff sign-in"
      lead="For the owner and the team of Lingeries by Sisioyin."
      demo="staff"
    >
      <SignInForm
        next={next ?? null}
        action={staffSignInAction}
        forgotHref="/admin/forgot-password"
        emailLabel="Staff email address"
      />
    </AuthCard>
  );
}
