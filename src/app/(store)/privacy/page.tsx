import type { Metadata } from "next";
import { PRIVACY } from "@/content";
import { LegalPage } from "@/features/legal/LegalPage";
import { fillBankDetails } from "@/lib/bank-details";
import { data } from "@/server/data";

export const metadata: Metadata = {
  title: "Privacy policy",
  alternates: { canonical: "/privacy" },
};

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const bank = await data.payments.bankDetails();
  return (
    <LegalPage
      title="Privacy policy"
      {...PRIVACY}
      intro={fillBankDetails(PRIVACY.intro, bank)}
      sections={PRIVACY.sections.map((s) => ({ ...s, body: fillBankDetails(s.body, bank) }))}
    />
  );
}
