import type { MetadataRoute } from "next";
import { BRAND } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/cart", "/checkout", "/confirmation", "/api/"],
      },
    ],
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
  };
}
