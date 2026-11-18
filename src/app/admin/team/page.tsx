import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/PageHeader";
import { TeamManager } from "@/features/admin/TeamManager";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Roles and invites" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireStaff("roles.manage", "/admin/team");
  return (
    <>
      <PageHeader
        title="Roles and invites"
        lead="Who can sign in to the admin, and what they can do."
      />
      <TeamManager staff={await data.admin.staff()} selfId={user.id} />
    </>
  );
}
