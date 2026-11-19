import type { Metadata } from "next";
import { TERMS } from "@/content";
import { LegalPage } from "@/features/legal/LegalPage";
import { fillBankDetails } from "@/lib/bank-details";
import { data } from "@/server/data";

export const metadata: Metadata = {
  title: "Terms of service",
  alternates: { canonical: "/terms" },
};

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const bank = await data.payments.bankDetails();
  return (
    <LegalPage
      title="Terms of service"
      {...TERMS}
      intro={fillBankDetails(TERMS.intro, bank)}
      sections={TERMS.sections.map((s) => ({ ...s, body: fillBankDetails(s.body, bank) }))}
    />
  );
}
