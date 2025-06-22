import { env } from "@/env";
import { withAnalyzer } from "@repo/next-config";
import type { NextConfig } from "next";

let nextConfig: NextConfig = {};

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
