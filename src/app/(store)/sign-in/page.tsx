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
  searchParams: Promise<{ next?: string; confirmed?: string }>;
}) {
  const { next, confirmed } = await searchParams;
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
      {confirmed === "1" ? (
        <p role="status" className="mb-4 border-l-4 border-primary bg-primary-tint p-3 text-base">
          Your address is confirmed, please sign in.
        </p>
      ) : null}
      <SignInForm next={next ?? null} action={signInAction} forgotHref="/forgot-password" />
      <OrDivider />
      <GoogleButton label="Continue with Google" />
    </AuthCard>
  );
}
