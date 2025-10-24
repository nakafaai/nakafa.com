import { config, withAnalyzer, withMDX } from "@repo/next-config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { env } from "@/env";

const withNextIntl = createNextIntlPlugin(
  "../../packages/internationalization/src/request.ts",
);

let nextConfig: NextConfig = config;

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default withMDX(withNextIntl(nextConfig));
