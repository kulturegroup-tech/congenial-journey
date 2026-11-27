import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Prefetch only each screen's prebuilt outline, served from Vercel's cache. With this on, every
  // page load also rendered every other screen in the sidebar on the server, which on the free
  // plan's small CPU slowed down the screen you actually asked for.
  partialPrefetching: false,
  // Sending a share from Gmail draws the cover page on the server, which reads this font from disk.
  outputFileTracingIncludes: { "/**": ["./public/fonts/InstrumentSerif-Regular.ttf"] },
  // "/" is just a way into Today: send people there before any server work happens.
  async redirects() {
    return [{ source: "/", destination: "/today", permanent: false }];
  },
  experimental: {
    // Reuse a page you visited in the last 30 seconds when you go back to it, instead of waiting
    // on the server again. A page fetched ahead because the pointer rested on its link
    // (components/fast-link.tsx) is reused for up to a minute. Saving anything clears both, so
    // your own edits always show at once; a teammate's change shows within a minute.
    staleTimes: { dynamic: 30, static: 60 },
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
