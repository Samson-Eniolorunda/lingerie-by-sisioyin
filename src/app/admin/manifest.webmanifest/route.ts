import { adminPath } from "@/lib/adminPath";
import { BRAND } from "@/config/site";

/** Separate manifest so the staff area installs as its own app, scoped to the admin pages (Q-02). */
export function GET(): Response {
  return Response.json(
    {
      name: `${BRAND.name} Admin`,
      short_name: "LBS Admin",
      start_url: adminPath("/"),
      scope: adminPath("/"),
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
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
