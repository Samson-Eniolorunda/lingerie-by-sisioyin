import type { MetadataRoute } from "next";
import { BRAND } from "@/config/site";

/** Storefront web app manifest (Q-01). The icons are placeholders until the logo is supplied. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: "Sisioyin",
    description: BRAND.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFBFC",
    theme_color: "#A62B5E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
