import Link from "next/link";
import { CookieSettingsButton } from "@/features/consent/ConsentBanner";
import { BRAND, CATEGORY_LINKS, CONTACT, SUPPORT_LINKS, whatsappLink } from "@/config/site";

const link =
  "flex min-h-11 items-center text-base text-on-footer/80 no-underline hover:text-on-footer";
const heading = "text-sm font-medium uppercase tracking-wider text-on-footer/60";

export function Footer() {
  return (
    <footer
      data-print="hide"
      className="mt-24 bg-footer pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+1rem)] text-on-footer md:pb-8"
    >
      <div className="mx-auto grid max-w-[1360px] gap-10 px-[max(var(--gutter),var(--safe-left))] py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl font-semibold tracking-[0.2em] uppercase">Lingerie</p>
          <p className="font-display text-base tracking-[0.16em] text-on-footer/70 italic">
            by Sisioyin
          </p>
          <p className="mt-4 max-w-xs text-base text-on-footer/80">{BRAND.tagline}</p>
        </div>
        <nav aria-label="Shop">
          <h2 className={heading}>Shop</h2>
          <ul className="mt-2">
            <li>
              <Link href="/shop" className={link}>
                All products
              </Link>
            </li>
            <li>
              <Link href="/shop?is_new=true" className={link}>
                New arrivals
              </Link>
            </li>
            {CATEGORY_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Help">
          <h2 className={heading}>Help</h2>
          <ul className="mt-2">
            <li>
              <Link href="/dashboard" className={link}>
                My account
              </Link>
            </li>
            {SUPPORT_LINKS.filter((l) => l.href !== "/terms" && l.href !== "/privacy").map(
              (item) => (
                <li key={item.href}>
                  <Link href={item.href} className={link}>
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
        <div>
          <h2 className={heading}>Follow and write to us</h2>
          <ul className="mt-2">
            <li>
              <a
                href={CONTACT.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                Instagram
              </a>
            </li>
            <li>
              <a href={CONTACT.tiktok} target="_blank" rel="noopener noreferrer" className={link}>
                TikTok
              </a>
            </li>
            <li>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={link}>
                WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1360px] flex-col gap-1 border-t border-on-footer/20 px-[max(var(--gutter),var(--safe-left))] pt-4 text-sm text-on-footer/80 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          © {new Date().getFullYear()} {BRAND.name}
        </p>
        <p className="flex gap-4">
          <Link
            href="/terms"
            className="flex min-h-11 items-center text-on-footer/80 no-underline hover:text-on-footer"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="flex min-h-11 items-center text-on-footer/80 no-underline hover:text-on-footer"
          >
            Privacy
          </Link>
          <CookieSettingsButton className="flex min-h-11 items-center text-on-footer/80 underline-offset-4 hover:text-on-footer hover:underline" />
        </p>
      </div>
    </footer>
  );
}
