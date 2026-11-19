import { countOf } from "@/lib/plural";
import { jsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Disclosure } from "@/components/ui/Disclosure";
import { BRAND } from "@/config/site";
import { Gallery } from "@/features/product/Gallery";
import { PurchasePanel } from "@/features/product/PurchasePanel";
import { ShareRow } from "@/features/product/ShareRow";
import { HasBar } from "@/features/shell/HasBar";
import { formatNaira } from "@/lib/money";
import { getProductBySlug } from "@/server/queries/catalogue";
import { DELIVERY_STATES } from "@/lib/delivery";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description.slice(0, 155),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 155),
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const url = `${BRAND.siteUrl}/products/${product.slug}`;

  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: product.category,
    url,
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: product.priceNgn,
      availability:
        product.qty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.avgRating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-[1360px] pb-[calc(var(--bar-h)+var(--safe-bottom))] sm:pb-0 md:px-8 md:pt-8">
      <HasBar />
      <nav aria-label="Breadcrumb" className="px-4 py-2 text-sm text-subtle md:px-0">
        <Link href="/shop" className="inline-flex min-h-11 min-w-11 items-center">
          Shop
        </Link>
        <span aria-hidden="true"> / </span>
        <Link
          href={`/shop?category=${product.category}`}
          className="inline-flex min-h-11 items-center"
        >
          {product.category}
        </Link>
      </nav>
      <div className="md:grid md:grid-cols-2 md:gap-12">
        <Gallery images={product.images} name={product.name} />
        <div className="px-4 pt-5 md:sticky md:top-24 md:self-start md:px-0 md:pt-0">
          {product.isNew ? <Badge tone="new">New</Badge> : null}
          <p className="text-sm tracking-wider text-subtle uppercase">
            {product.category} · {product.gender}
          </p>
          <h1 className="mt-1 font-display text-[1.75rem] leading-tight md:text-4xl">
            {product.name}
          </h1>
          <p className="tabular mt-2 text-xl font-semibold">{formatNaira(product.priceNgn)}</p>
          {product.reviewCount > 0 ? (
            <p className="mt-1 text-sm text-muted">
              <span className="text-accent">★</span> {product.avgRating.toFixed(1)} from{" "}
              {countOf(product.reviewCount, "review")}
            </p>
          ) : null}
          <div className="mt-6">
            <PurchasePanel product={product} />
          </div>
          <div className="mt-8">
            <Disclosure title="Description">
              <p>{product.description}</p>
            </Disclosure>
            <Disclosure title="Delivery">
              <p>
                Free within Lagos. Other states:{" "}
                {DELIVERY_STATES.filter((s) => s.feeNgn > 0)
                  .map((s) => `${s.label} ${formatNaira(s.feeNgn)}`)
                  .join(", ")}
                .
              </p>
            </Disclosure>
            <Disclosure title="Returns">
              <p>
                Returns are accepted for seven days after delivery. See the{" "}
                <Link href="/terms">terms</Link> for the conditions.
              </p>
            </Disclosure>
          </div>
          <div className="mt-4">
            <ShareRow name={product.name} url={url} />
          </div>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
    </div>
  );
}
