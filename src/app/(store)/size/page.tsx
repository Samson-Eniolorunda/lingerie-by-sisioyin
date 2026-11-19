import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { FIT_TIPS, MEASURE_CARDS, MEASURE_INTRO } from "@/content/size-guide";
import { SizeGuideContent } from "@/features/size/SizeGuideContent";

export const metadata: Metadata = {
  title: "Size guide",
  description:
    "How to measure, size charts for bras, panties, bodysuits and loungewear, and a bra size calculator.",
  alternates: { canonical: "/size" },
};

export default function SizePage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-8 md:py-14">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">Size guide</h1>
      <p className="mt-3 text-lg text-muted">
        Getting the right size makes all the difference. Use the measuring guide, the size charts
        and the bra calculator to find your fit.
      </p>

      <section aria-labelledby="measure" className="mt-10">
        <h2 id="measure" className="font-display text-3xl">
          How to measure
        </h2>
        <p className="mt-2 text-base text-muted">{MEASURE_INTRO}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {MEASURE_CARDS.map((card) => (
            <div key={card.title} className="border border-line bg-surface p-4">
              <dt className="font-sans text-lg font-semibold">{card.title}</dt>
              <dd className="mt-1 text-base text-muted">{card.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="charts" className="mt-12">
        <h2 id="charts" className="sr-only">
          Charts and calculator
        </h2>
        <SizeGuideContent />
      </section>

      <section aria-labelledby="tips" className="mt-12">
        <h2 id="tips" className="font-display text-3xl">
          Fit tips
        </h2>
        <dl className="mt-4 space-y-4">
          {FIT_TIPS.map((tip) => (
            <div key={tip.title}>
              <dt className="font-sans text-base font-semibold">{tip.title}</dt>
              <dd className="text-base text-muted">{tip.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 border-t border-line pt-8 text-center">
        <h2 className="font-display text-3xl">Still not sure?</h2>
        <p className="mx-auto mt-2 max-w-md text-base text-muted">
          Reach out on WhatsApp or send us a message. We are happy to help you find the right fit.
        </p>
        <ButtonLink href="/contact" className="mt-5">
          Contact us
        </ButtonLink>
      </section>
    </div>
  );
}
