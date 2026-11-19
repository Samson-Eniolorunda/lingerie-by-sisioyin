import { adminPath } from "@/lib/adminPath";
import type { Metadata } from "next";
import { KeyboardWatcher } from "@/features/shell/KeyboardWatcher";
import { AdminShell } from "@/features/admin/AdminShell";
import { visibleNav } from "@/features/admin/nav";
import { currentUser } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
  manifest: adminPath("/manifest.webmanifest"),
};

/**
 * The staff area has its own frame and its own session. A visitor with no staff session sees the
 * bare page (the sign-in), so the layout never redirects; each page asks for its own permission.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser("staff");
  if (!user?.role)
    return (
      <>
        <KeyboardWatcher />
        <main id="main" className="mx-auto w-full max-w-[1100px] px-4">
          {children}
        </main>
      </>
    );
  const summary = await data.admin.summary();
  return (
    <AdminShell
      items={visibleNav(user.role)}
      name={`${user.firstName} ${user.lastName}`.trim() || user.email}
      role={user.role}
      badges={{
        [adminPath("/orders")]: summary.pendingOrders,
        [adminPath("/messages")]: summary.unreadMessages,
      }}
    >
      <KeyboardWatcher />
      {children}
    </AdminShell>
  );
}
