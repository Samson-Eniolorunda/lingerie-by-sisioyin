import { adminPath } from "@/lib/adminPath";
import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/PageHeader";
import { SettingsForm } from "@/features/admin/SettingsForm";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireStaff("settings.manage", adminPath("/settings"));
  return (
    <>
      <PageHeader
        title="Settings"
        lead="Changes appear in the shop straight away once the database is connected."
      />
      <SettingsForm initial={await data.admin.settings()} />
    </>
  );
}
