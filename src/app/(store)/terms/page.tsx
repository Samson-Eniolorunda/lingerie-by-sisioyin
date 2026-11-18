import type { Metadata } from "next";
import { TERMS } from "@/content";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPage title="Terms of service" {...TERMS} />;
}
