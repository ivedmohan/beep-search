import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic (Next 15-style) rendering model: pages are dynamic on demand.
  // Cache Components is deliberately off to keep data fetching simple for the MVP.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
