import { config, withAnalyzer } from "@repo/next-config";
import { analyzeKeys } from "@repo/next-config/keys";
import type { NextConfig } from "next";

const configEnv = analyzeKeys();

const nextConfig = {
  ...config,
  serverExternalPackages: [...config.serverExternalPackages, "express"],
} satisfies NextConfig;

const analyzedConfig =
  configEnv.ANALYZE === "true" ? withAnalyzer(nextConfig) : nextConfig;

export default analyzedConfig;
