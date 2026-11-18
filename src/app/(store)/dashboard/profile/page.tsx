import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileForm } from "@/features/account/ProfileForm";
import { requireCustomer } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const user = await requireCustomer("/dashboard/profile");
  const profile = await data.account.profile(user.id);
  if (!profile) notFound();
  return (
    <div>
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">Profile</h1>
      <ProfileForm profile={profile} />
    </div>
  );
}
