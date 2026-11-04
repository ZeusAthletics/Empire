import type { NextConfig } from "next";

const noIndexHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: noIndexHeaders }];
  },
};

export default nextConfig;
