import type { MetadataRoute } from "next";
import { BRAND } from "@/config/site";
import { listProducts } from "@/server/queries/catalogue";

/** Rebuilt at most hourly, so a new product reaches the sitemap without a deployment. */
export const revalidate = 3600;

const PAGES = ["", "/shop", "/size", "/faq", "/contact", "/privacy", "/terms", "/track"] as const;

/** Public, indexable pages and every live product. Account, bag, checkout and admin pages are left out on purpose. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items: products } = await listProducts();
  return [
    ...PAGES.map((path) => ({
      url: `${BRAND.siteUrl}${path}`,
      changeFrequency: path === "" || path === "/shop" ? ("daily" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path === "/shop" ? 0.9 : 0.5,
    })),
    ...products.map((p) => ({
      url: `${BRAND.siteUrl}/products/${p.slug}`,
      lastModified: new Date(p.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
