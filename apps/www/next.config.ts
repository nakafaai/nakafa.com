import path from "node:path";
import { config, withAnalyzer, withMDX } from "@repo/next-config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { env } from "@/env";

const withNextIntl = createNextIntlPlugin(
  "../../packages/internationalization/src/request.ts"
);

let nextConfig: NextConfig = {
  ...config,
  // Next.js recommends outputFileTracingRoot in monorepos so files outside the
  // app folder are included in the production trace.
  // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  // `process.cwd()` resolves to the app directory (`apps/www`) during Next.js
  // config loading, so walking up two levels targets the monorepo root.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  outputFileTracingIncludes: {
    "/llms.mdx/\\[\\.\\.\\.slug\\]": [
      "../../packages/contents/{articles,exercises,subject}/**/*",
      "../../packages/contents/_data/quran.ts",
    ],
    "/og/\\[\\.\\.\\.slug\\]": [
      "../../packages/contents/{articles,exercises,subject}/**/*",
    ],
    "/\\[locale\\]/og/\\[\\.\\.\\.slug\\]": [
      "../../packages/contents/{articles,exercises,subject}/**/*",
    ],
    "/\\[locale\\]/exercises/\\[category\\]/\\[type\\]/\\[material\\]/\\[\\.\\.\\.slug\\]":
      ["../../packages/contents/{articles,exercises,subject}/**/*"],
    "/\\[locale\\]/try-out/\\[product\\]/\\[slug\\]/part/\\[partKey\\]": [
      "../../packages/contents/{articles,exercises,subject}/**/*",
    ],
  },
  serverExternalPackages: [
    ...(config.serverExternalPackages ?? []),
    "@takumi-rs/image-response",
  ],
  async rewrites() {
    const llmSource = [
      "/:path*.md",
      "/:path*.mdx",
      "/:path*.txt",
      "/:path*/llms.txt",
    ];
    const llmDestination = "/llms.mdx/:path*";
    const ogSource = ["/:path*.png", "/:path*.og", "/:path*/image.png"];
    const ogDestination = "/og/:path*";
    return [
      ...llmSource.map((source) => ({
        source,
        destination: llmDestination,
      })),
      ...ogSource.map((source) => ({
        source,
        destination: ogDestination,
      })),
    ];
  },
  async redirects() {
    const redirects = [
      {
        source: "/subject/junior-high-school/:path*",
        destination: "/subject/middle-school/:path*",
        permanent: true,
      },
      {
        source: "/subject/senior-high-school/:path*",
        destination: "/subject/high-school/:path*",
        permanent: true,
      },
      {
        source: "/exercises/high-school/snbt/quantitative-reasoning/:path*",
        destination:
          "/exercises/high-school/snbt/quantitative-knowledge/:path*",
        permanent: true,
      },
      {
        source: "/discord",
        destination: "https://discord.gg/CPCSfKhvfQ",
        permanent: false,
      },
      {
        source: "/community",
        destination: "https://discord.gg/CPCSfKhvfQ",
        permanent: false,
      },
    ] as const;

    return redirects.flatMap(({ source, destination, permanent }) => {
      const isExternal = destination.startsWith("http");
      return [
        {
          source,
          destination,
          permanent,
        },
        {
          source: `/:locale${source}`,
          destination: isExternal ? destination : `/:locale${destination}`,
          permanent,
        },
      ];
    });
  },
};

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default withMDX(withNextIntl(nextConfig));
