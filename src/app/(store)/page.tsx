import { jsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { BRAND, CONTACT, whatsappLink } from "@/config/site";
import { ProductCard } from "@/features/catalogue/ProductCard";
import { DELIVERY_STATES } from "@/lib/delivery";
import { formatNaira } from "@/lib/money";
import { newArrivals } from "@/server/queries/catalogue";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} | Lingerie, loungewear and underwear` },
  description: BRAND.tagline,
  alternates: { canonical: "/" },
};

const ORGANISATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND.name,
  url: BRAND.siteUrl,
  logo: `${BRAND.siteUrl}/icons/icon-512.png`,
  email: CONTACT.email,
  telephone: "+2349033344860",
  sameAs: [CONTACT.instagram, CONTACT.tiktok],
};

const HERO = {
  src: "/placeholders/portrait-3x4.svg",
  alt: "Placeholder image for the home page photograph. The photograph is to follow.",
};

const CATEGORIES = [
  { href: "/shop?category=Lingerie", label: "Lingerie", tall: true },
  { href: "/shop?category=Loungewear", label: "Loungewear", tall: false },
  { href: "/shop?category=Underwear", label: "Underwear", tall: false },
] as const;

export default async function HomePage() {
  const products = await newArrivals(8);
  const fees = DELIVERY_STATES.filter((s) => s.feeNgn > 0).map((s) => s.feeNgn);
  const lowest = Math.min(...fees);
  const highest = Math.max(...fees);

  return (
    <>
      <p className="bg-tint px-4 py-2 text-center text-xs font-medium tracking-[0.12em] text-ink-strong uppercase">
        Delivery to {DELIVERY_STATES.length} states · Free within Lagos
      </p>

      <section className="mx-auto grid max-w-[1360px] md:grid-cols-12 md:items-end">
        <div className="relative aspect-[3/4] max-h-[42svh] w-full overflow-hidden bg-tint md:order-2 md:col-span-7 md:aspect-auto md:max-h-none md:min-h-[42rem]">
          <Image
            src={HERO.src}
            alt={HERO.alt}
            fill
            priority
            sizes="(max-width: 767px) 100vw, 58vw"
            unoptimized
            className="object-cover"
          />
        </div>
        <div className="px-4 py-6 sm:px-8 md:order-1 md:col-span-5 md:py-16 md:pr-12">
          <p className="text-xs font-medium tracking-[0.14em] text-subtle uppercase">
            Lingerie, loungewear and underwear
          </p>
          <h1 className="mt-3 font-display text-[2.5rem] leading-[1.1] md:text-6xl md:leading-[1.06]">
            Made to be <em className="font-medium italic">lived in</em>, every day.
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted">
            Soft fabrics and honest sizing, delivered to {DELIVERY_STATES.length} states.
          </p>
          <ButtonLink href="/shop" variant="text" className="mt-6 -ml-2 text-lg">
            Shop the collection
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="new-in" className="mx-auto mt-14 max-w-[1360px] md:mt-24">
        <div className="flex items-baseline justify-between px-4 sm:px-8">
          <h2 id="new-in" className="font-display text-[1.75rem] md:text-4xl">
            New in
          </h2>
          <Link href="/shop?is_new=true" className="flex min-h-11 items-center text-base">
            View all
          </Link>
        </div>
        <ul className="mt-4 flex snap-x snap-mandatory scrollbar-none gap-3 overflow-x-auto px-4 pb-2 sm:px-8 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible">
          {products.slice(0, 8).map((product, index) => (
            <li key={product.id} className="w-[44vw] shrink-0 snap-start md:w-auto">
              <ProductCard product={product} priority={index < 2} />
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="collections"
        className="mx-auto mt-14 max-w-[1360px] px-4 sm:px-8 md:mt-24"
      >
        <h2 id="collections" className="font-display text-[1.75rem] md:text-4xl">
          Collections
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 md:grid-rows-2 md:gap-6">
          {CATEGORIES.map((category) => (
            <Link
              key={category.label}
              href={category.href}
              className={`group block text-ink no-underline hover:text-ink ${category.tall ? "md:row-span-2" : ""}`}
            >
              <div
                className={`relative w-full overflow-hidden bg-tint ${category.tall ? "aspect-[3/4] md:aspect-auto md:h-[calc(100%-3.5rem)]" : "aspect-[3/4] md:aspect-[16/9]"}`}
              >
                <Image
                  src="/placeholders/portrait-3x4.svg"
                  alt=""
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  unoptimized
                  className="object-cover"
                />
              </div>
              <p className="flex min-h-14 items-center bg-footer px-4 font-display text-2xl text-on-footer">
                {category.label}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-label="Delivery and returns"
        className="mx-auto mt-14 max-w-[1360px] px-4 sm:px-8 md:mt-24"
      >
        <p className="border-y border-line py-6 text-base text-muted md:text-lg">
          Free delivery within Lagos, and {formatNaira(lowest)} to {formatNaira(highest)} to the
          other six states we serve. Payment is by bank transfer and a person confirms it.{" "}
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
            Message us on WhatsApp
          </a>{" "}
          or follow us on{" "}
          <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          .
        </p>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(ORGANISATION) }}
      />
    </>
  );
}
