import type { MetadataRoute } from "next";
import { ADMIN_HOST } from "@/lib/adminPath";
import { BRAND } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // With its own host the panel is a 404 here, so it is not named in a public file.
        disallow: [
          ...(ADMIN_HOST ? [] : ["/admin"]),
          "/dashboard",
          "/cart",
          "/checkout",
          "/confirmation",
          "/api/",
        ],
      },
    ],
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
  };
}
