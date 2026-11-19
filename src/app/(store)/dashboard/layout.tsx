import { AccountNav } from "@/features/account/AccountNav";
import { currentUser } from "@/server/auth/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Each page sends a signed-out visitor to sign in with its own return address; the layout only decorates.
  const user = await currentUser("customer");
  if (!user) return <>{children}</>;
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-8 md:pt-10">
      <p className="text-sm text-subtle">Signed in as {user.email}</p>
      <div className="mt-4 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-12">
        <AccountNav />
        <div className="mt-6 min-w-0 lg:mt-0">{children}</div>
      </div>
    </div>
  );
}
