import { config, withAnalyzer } from "@repo/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

const nextConfig = {
  ...config,
  serverExternalPackages: [...config.serverExternalPackages, "express"],
} satisfies NextConfig;

const analyzedConfig =
  env.ANALYZE === "true" ? withAnalyzer(nextConfig) : nextConfig;

export default analyzedConfig;
