import path from "node:path";
import { config, withAnalyzer, withMDX } from "@repo/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

const nextConfig = {
  ...config,
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
} satisfies NextConfig;

const analyzedConfig =
  env.ANALYZE === "true" ? withAnalyzer(nextConfig) : nextConfig;

export default withMDX(analyzedConfig);
