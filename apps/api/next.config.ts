import path from "node:path";
import { config, withAnalyzer, withMDX } from "@repo/next-config";
import { analyzeKeys } from "@repo/next-config/keys";
import type { NextConfig } from "next";

const configEnv = analyzeKeys();

const nextConfig = {
  ...config,
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
} satisfies NextConfig;

const analyzedConfig =
  configEnv.ANALYZE === "true" ? withAnalyzer(nextConfig) : nextConfig;

export default withMDX(analyzedConfig);
