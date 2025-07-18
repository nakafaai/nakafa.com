import { withAnalyzer, withMDX } from "@repo/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

let nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
};

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default withMDX(nextConfig);
