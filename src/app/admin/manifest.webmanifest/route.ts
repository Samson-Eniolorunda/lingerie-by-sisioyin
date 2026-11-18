import { BRAND } from "@/config/site";

/** Separate manifest so the staff area installs as its own app, scoped to /admin (Q-02). */
export function GET(): Response {
  return Response.json(
    {
      name: `${BRAND.name} Admin`,
      short_name: "LBS Admin",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#FAF6F0",
      theme_color: "#6B1F2E",
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
