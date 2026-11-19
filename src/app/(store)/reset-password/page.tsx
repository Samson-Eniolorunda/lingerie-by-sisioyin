import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/AuthCard";
import { ResetForm } from "@/features/auth/ResetForm";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** The emailed link lands on `/auth/callback`, which exchanges its code for a session; this page needs that session. */
export default async function ResetPasswordPage() {
  const user = (await currentUser("customer")) ?? (await currentUser("staff"));
  return (
    <AuthCard
      title={user ? "Choose a new password" : "This link is not valid"}
      {...(user ? { lead: "Pick something you do not use elsewhere." } : {})}
    >
      <ResetForm hasSession={user !== null} />
    </AuthCard>
  );
}
