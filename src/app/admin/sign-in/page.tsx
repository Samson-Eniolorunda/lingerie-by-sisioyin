import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthLink } from "@/features/auth/AuthCard";
import { InviteForm } from "@/features/auth/InviteForm";
import { ROLE_LABELS } from "@/lib/permissions";
import { data } from "@/server/data";
import { SignInForm } from "@/features/auth/SignInForm";
import { safeNext } from "@/lib/safe-next";
import { staffSignInAction } from "@/server/actions/auth";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Staff sign-in" };

export default async function StaffSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invite?: string; confirmed?: string }>;
}) {
  const { next, invite, confirmed } = await searchParams;
  if (invite) {
    // A staff invitation link: the address and role are the invitation's own.
    const details = await data.auth.invitation(invite.slice(0, 200));
    return (
      <AuthCard
        title="Join the team"
        lead="Create your staff account for Lingeries by Sisioyin."
        footer={
          <>
            Already have an account? <AuthLink href="/admin/sign-in">Sign in</AuthLink>
          </>
        }
      >
        {details ? (
          <InviteForm token={invite} email={details.email} roleLabel={ROLE_LABELS[details.role]} />
        ) : (
          <p role="alert" className="border-l-4 border-error bg-error-bg p-3 text-base">
            This invitation has expired or has already been used. Ask the owner to send you a new
            one.
          </p>
        )}
      </AuthCard>
    );
  }
  if (await currentUser("staff")) redirect(safeNext(next, "/admin"));
  return (
    <AuthCard
      title="Staff sign-in"
      lead="For the owner and the team of Lingeries by Sisioyin."
      demo="staff"
    >
      {confirmed === "1" ? (
        <p role="status" className="mb-4 border-l-4 border-primary bg-primary-tint p-3 text-base">
          Your address is confirmed, please sign in.
        </p>
      ) : null}
      <SignInForm
        next={next ?? null}
        action={staffSignInAction}
        forgotHref="/admin/forgot-password"
        emailLabel="Staff email address"
      />
    </AuthCard>
  );
}
