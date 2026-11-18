import type { Metadata } from "next";
import { FaqView } from "@/features/faq/FaqView";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about orders, shipping, returns, payment, sizing and your account.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-[680px] px-4 py-8 sm:px-8 md:py-14">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">
        Frequently asked questions
      </h1>
      <div className="mt-6">
        <FaqView />
      </div>
    </div>
  );
}
