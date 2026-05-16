import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "tesseract.js"],
  experimental: {
    // Router Cache: how long the last successful RSC payload for a dynamic
    // (`force-dynamic` / `cache: 'no-store'`) segment remains usable on the
    // client. Back-nav within `dynamic` seconds paints instantly from the
    // cache while a background revalidate refreshes the data.
    //
    // Verified against `next@16.x` — kept under `experimental` for now in
    // case the flag is promoted in a later release.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
