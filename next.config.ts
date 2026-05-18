import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // Puppeteer pulls in chromium binaries — keep it out of the bundler so
  // it loads dynamically at runtime.
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
};

export default nextConfig;
