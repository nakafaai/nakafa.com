import path from "node:path";
import { config, withAnalyzer } from "@repo/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

const NAKAFA_CONTENT_TRACE_FILES = [
  "../../packages/contents/{articles,exercises,subject}/**/*",
  "../../packages/contents/_data/quran.ts",
] as const;

const nextConfig = {
  ...config,
  // MCP reads filesystem-backed Nakafa content at runtime, so production
  // output tracing must include those files from the monorepo root.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  outputFileTracingIncludes: {
    "/\\[transport\\]": [...NAKAFA_CONTENT_TRACE_FILES],
  },
  serverExternalPackages: [...config.serverExternalPackages, "express"],
} satisfies NextConfig;

const analyzedConfig =
  env.ANALYZE === "true" ? withAnalyzer(nextConfig) : nextConfig;

export default analyzedConfig;
