import { RichText } from "@/components/ui/RichText";
import { ButtonLink } from "@/components/ui/Button";
import type { ContentNode } from "@/content/schema";
import { Toc } from "./Toc";

interface Section {
  readonly id: string;
  readonly title: string;
  readonly body: readonly ContentNode[];
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  readonly title: string;
  readonly updated: string;
  readonly intro: readonly ContentNode[];
  readonly sections: readonly Section[];
}) {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-8 md:py-14">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">{title}</h1>
      <p className="mt-1 text-sm text-subtle">Last updated: {updated}</p>
      <div className="mt-4 max-w-[680px]">
        <RichText nodes={intro} />
      </div>
      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-12">
        <Toc items={sections.map((s) => ({ id: s.id, title: s.title }))} />
        <div className="max-w-[680px]">
          {sections.map((section, i) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-h`}
              className="scroll-mt-24 border-t border-line py-8 first:mt-6"
            >
              <h2 id={`${section.id}-h`} className="font-display text-3xl">
                <span className="tabular mr-2 text-subtle">{i + 1}.</span>
                {section.title}
              </h2>
              <RichText nodes={section.body} className="mt-3" />
            </section>
          ))}
          <div className="border-t border-line pt-8 text-center">
            <p className="text-base text-muted">Questions about this page?</p>
            <ButtonLink href="/contact" className="mt-3">
              Contact us
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
