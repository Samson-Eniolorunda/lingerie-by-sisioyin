import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthLink } from "@/features/auth/AuthCard";
import { GoogleButton, OrDivider } from "@/features/auth/GoogleButton";
import { SignUpForm } from "@/features/auth/SignUpForm";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: true },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await currentUser("customer")) redirect(safeNext(next, "/dashboard"));
  return (
    <AuthCard
      title="Create an account"
      lead="It takes a minute. You can still check out as a guest."
      footer={
        <>
          Already have an account?{" "}
          <AuthLink
            href={
              next
                ? `/sign-in?next=${encodeURIComponent(safeNext(next, "/dashboard"))}`
                : "/sign-in"
            }
          >
            Sign in
          </AuthLink>
        </>
      }
    >
      <SignUpForm next={next ?? null} />
      <OrDivider />
      <GoogleButton label="Sign up with Google" />
    </AuthCard>
  );
}
