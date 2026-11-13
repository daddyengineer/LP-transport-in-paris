import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    const year = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/images/:path*", headers: year },
      { source: "/videos/:path*", headers: year },
      { source: "/favicon.ico", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
};

export default nextConfig;
