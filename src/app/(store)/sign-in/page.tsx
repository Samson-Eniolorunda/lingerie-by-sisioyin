import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthLink } from "@/features/auth/AuthCard";
import { GoogleButton, OrDivider } from "@/features/auth/GoogleButton";
import { SignInForm } from "@/features/auth/SignInForm";
import { safeNext } from "@/lib/safe-next";
import { signInAction } from "@/server/actions/auth";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next, "/dashboard");
  if (await currentUser("customer")) redirect(target);
  return (
    <AuthCard
      title="Sign in"
      lead="Follow your orders, keep your addresses and find your wishlist on any phone."
      demo="customer"
      footer={
        <>
          New here?{" "}
          <AuthLink href={next ? `/sign-up?next=${encodeURIComponent(target)}` : "/sign-up"}>
            Create an account
          </AuthLink>
        </>
      }
    >
      <SignInForm next={next ?? null} action={signInAction} forgotHref="/forgot-password" />
      <OrDivider />
      <GoogleButton label="Continue with Google" />
    </AuthCard>
  );
}
