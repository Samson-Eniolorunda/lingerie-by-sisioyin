import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser needs to know whether the admin panel has its own host (see src/lib/adminPath.ts).
  env: { NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "" },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
};

export default config;
