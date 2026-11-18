import type { Metadata } from "next";
import { PRIVACY } from "@/content";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" {...PRIVACY} />;
}
