import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // @ts-expect-error nodeMiddleware is supported at runtime in Next 15.5.x but missing from public types
    nodeMiddleware: true,
  },
};

export default nextConfig;
