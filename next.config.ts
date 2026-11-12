import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Prefetch only each screen's prebuilt outline, served from Vercel's cache. With this on, every
  // page load also rendered every other screen in the sidebar on the server, which on the free
  // plan's small CPU slowed down the screen you actually asked for.
  partialPrefetching: false,
  // "/" is just a way into Today: send people there before any server work happens.
  async redirects() {
    return [{ source: "/", destination: "/today", permanent: false }];
  },
  experimental: {
    // Reuse a page you visited in the last 30 seconds when you go back to it, instead of waiting
    // on the server again. Saving anything refreshes the page, so edits still show at once.
    staleTimes: { dynamic: 30 },
  },
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
