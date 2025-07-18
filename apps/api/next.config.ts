import path from "node:path";
import { withAnalyzer, withMDX } from "@repo/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

let nextConfig: NextConfig = {
  // Only apply file tracing configuration in production
  ...(process.env.NODE_ENV === "production" && {
    outputFileTracingRoot: path.join(process.cwd(), "../../"),
    outputFileTracingIncludes: {
      // Include all MDX files and related content from packages/contents
      "**/*": ["packages/contents/**/*"],
    },
  }),
};

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default withMDX(nextConfig);
