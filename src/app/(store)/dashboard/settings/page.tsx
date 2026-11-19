import type { Metadata } from "next";
import { SettingsPanel } from "@/features/account/SettingsPanel";
import { requireCustomer } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  await requireCustomer("/dashboard/settings");
  return (
    <div id="settings">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">Settings</h1>
      <SettingsPanel />
    </div>
  );
}
