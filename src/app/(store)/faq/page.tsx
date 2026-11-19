import type { Metadata } from "next";
import { FaqView } from "@/features/faq/FaqView";
import { data } from "@/server/data";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about orders, shipping, returns, payment, sizing and your account.",
  alternates: { canonical: "/faq" },
};

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const bank = await data.payments.bankDetails();
  return (
    <div className="mx-auto max-w-[680px] px-4 py-8 sm:px-8 md:py-14">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">
        Frequently asked questions
      </h1>
      <div className="mt-6">
        <FaqView bank={bank} />
      </div>
    </div>
  );
}
