import { withAnalyzer } from "@repo/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

let nextConfig: NextConfig = {};

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
