import type { Metadata } from "next";
import { CONTACT, whatsappLink } from "@/config/site";
import { ContactForm } from "@/features/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Message us on WhatsApp, call, email, or send a message through the form.",
  alternates: { canonical: "/contact" },
};

const row =
  "flex min-h-14 items-center justify-between gap-3 border-b border-line text-base text-ink no-underline hover:text-primary";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).subject;
  const subject = Array.isArray(raw) ? raw[0] : raw;
  return (
    <div className="mx-auto max-w-[680px] px-4 py-8 sm:px-8 md:py-14">
      <h1 className="font-display text-[2.125rem] leading-tight md:text-5xl">Contact</h1>
      <p className="mt-2 text-base text-muted">
        The quickest way to reach us is WhatsApp. You can also write to us here.
      </p>
      <ul className="mt-6 border-t border-line">
        <li>
          <a
            className={row}
            href={whatsappLink("Hello, I have a question.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>WhatsApp</span>
            <span className="tabular text-muted">{CONTACT.phoneDisplay}</span>
          </a>
        </li>
        <li>
          <a className={row} href={CONTACT.phoneLink}>
            <span>Call</span>
            <span className="tabular text-muted">{CONTACT.phoneDisplay}</span>
          </a>
        </li>
        <li>
          <a className={row} href={`mailto:${CONTACT.email}`}>
            <span>Email</span>
            <span className="truncate text-muted">{CONTACT.email}</span>
          </a>
        </li>
        <li>
          <a className={row} href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">
            <span>Instagram</span>
            <span className="text-muted">@lingeries_bysisioyin</span>
          </a>
        </li>
        <li>
          <a className={row} href={CONTACT.tiktok} target="_blank" rel="noopener noreferrer">
            <span>TikTok</span>
            <span className="text-muted">@lingeries_bysisioyin</span>
          </a>
        </li>
      </ul>
      <h2 className="mt-10 font-display text-3xl">Send a message</h2>
      <div className="mt-4">
        <ContactForm initialSubject={subject} />
      </div>
    </div>
  );
}
