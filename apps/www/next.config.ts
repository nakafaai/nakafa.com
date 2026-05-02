import path from "node:path";
import { createPostHogProxyRewrites } from "@repo/analytics/posthog/config";
import { routing } from "@repo/internationalization/src/routing";
import {
  config,
  createSecurityHeaders,
  withAnalyzer,
  withMDX,
} from "@repo/next-config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { env } from "@/env";

const withNextIntl = createNextIntlPlugin(
  "../../packages/internationalization/src/request.ts"
);

/**
 * Build the rewrite rules for SEO assets and the same-origin PostHog proxy.
 *
 * References:
 * https://posthog.com/docs/advanced/proxy/nextjs
 * https://posthog.com/docs/advanced/proxy/vercel
 */
function createAppRewrites() {
  const llmSource = ["/:path*.md", "/:path*.mdx", "/:path*/llms.txt"];
  const llmDestination = "/llms.mdx/:path*";
  const markdownAcceptHeader = [
    {
      type: "header",
      key: "accept",
      value: ".*text/markdown.*",
    },
  ];
  const markdownAcceptRewrites = routing.locales.flatMap((locale) => [
    {
      source: `/${locale}/articles/:path*`,
      destination: `/llms.mdx/${locale}/articles/:path*`,
      has: markdownAcceptHeader,
    },
    {
      source: `/${locale}/subject/:path*`,
      destination: `/llms.mdx/${locale}/subject/:path*`,
      has: markdownAcceptHeader,
    },
    {
      source: `/${locale}/exercises/:path*`,
      destination: `/llms.mdx/${locale}/exercises/:path*`,
      has: markdownAcceptHeader,
    },
    {
      source: `/${locale}/quran/:path*`,
      destination: `/llms.mdx/${locale}/quran/:path*`,
      has: markdownAcceptHeader,
    },
  ]);
  const ogSource = ["/:path*.png", "/:path*.og", "/:path*/image.png"];
  const ogDestination = "/og/:path*";

  return [
    // PostHog requires the specific static and array rewrites to come before the
    // catch-all analytics rewrite so asset cache headers are preserved.
    ...createPostHogProxyRewrites(env.POSTHOG_PROXY_HOST),
    ...markdownAcceptRewrites,
    ...llmSource.map((source) => ({
      source,
      destination: llmDestination,
    })),
    ...ogSource.map((source) => ({
      source,
      destination: ogDestination,
    })),
  ];
}

/**
 * Build the localized redirect list shared by all supported locales.
 */
function createLocalizedRedirects() {
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
      destination: "/exercises/high-school/snbt/quantitative-knowledge/:path*",
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
  ];

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
}

/**
 * Return the shared security headers for all application responses.
 */
function createAppHeaders() {
  return [
    {
      source: "/:path*",
      headers: createSecurityHeaders(),
    },
  ];
}

const nextConfig = {
  ...config,
  cacheComponents: true,
  // PostHog's same-origin proxy endpoints include trailing slashes such as
  // `/i/v0/e/`, so Next.js slash normalization must be disabled.
  skipTrailingSlashRedirect: true,
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
    "@takumi-rs/core",
  ],
  rewrites: createAppRewrites,
  redirects: createLocalizedRedirects,
  headers: createAppHeaders,
  experimental: {
    ...config.experimental,
    globalNotFound: true,
    rootParams: true,
  },
} satisfies NextConfig;

const analyzedConfig =
  env.ANALYZE === "true" ? withAnalyzer(nextConfig) : nextConfig;

export default withMDX(withNextIntl(analyzedConfig));
