import path from "node:path";
import { postHogProxyKeys } from "@repo/analytics/keys";
import { createPostHogProxyRewrites } from "@repo/analytics/posthog/config";
import {
  config,
  createSecurityHeaders,
  withAnalyzer,
  withMDX,
} from "@repo/next-config";
import { analyzeKeys } from "@repo/next-config/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { AGENT_DISCOVERY_HEADERS } from "@/lib/agent-discovery";

const configEnv = createEnv({
  extends: [analyzeKeys(), postHogProxyKeys()],
  runtimeEnv: {},
});

const withNextIntl = createNextIntlPlugin(
  "../../packages/internationalization/src/request.ts"
);

/**
 * Build the rewrite rules for agent discovery, SEO assets, and the PostHog proxy.
 *
 * References:
 * https://posthog.com/docs/advanced/proxy/nextjs
 * https://posthog.com/docs/advanced/proxy/vercel
 */
function createAppRewrites() {
  const agentDiscoveryRewrites = [
    {
      source: "/.well-known/llms.txt",
      destination: "/llms.txt",
    },
    {
      source: "/.well-known/agent-skills/nakafa/SKILL.md",
      destination: "/skill.md",
    },
  ];
  const llmSource = ["/:path*.md", "/:path*.mdx", "/:path*/llms.txt"];
  const llmDestination = "/llms.mdx/:path*";
  const ogSource = ["/:path*.png", "/:path*.og", "/:path*/image.png"];
  const ogDestination = "/og/:path*";
  const ogRouteRewrites = [
    {
      source: "/:locale/og/:path*/image.png",
      destination: "/:locale/og/:path*/image.png",
    },
    {
      source: "/og/:path*/image.png",
      destination: "/og/:path*/image.png",
    },
  ];

  const seoAssetRewrites = [
    ...llmSource.map((source) => ({
      source,
      destination: llmDestination,
    })),
    ...ogSource.map((source) => ({
      source,
      destination: ogDestination,
    })),
  ];

  return {
    // PostHog requires the specific static and array rewrites to come before the
    // catch-all analytics rewrite so asset cache headers are preserved.
    afterFiles: [
      ...createPostHogProxyRewrites(configEnv.POSTHOG_PROXY_HOST),
      ...agentDiscoveryRewrites,
      // Keep canonical OG image routes out of the broad extension rewrites.
      // After a pass-through match, Next checks the localized dynamic route
      // before continuing through the remaining `afterFiles` entries.
      ...ogRouteRewrites,
      ...seoAssetRewrites,
    ],
  };
}

/**
 * Build the localized redirect list shared by all supported locales.
 */
function createLocalizedRedirects() {
  const rootRedirects = [
    {
      source: "/sitemap.txt",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/about",
      destination: "/",
      permanent: true,
    },
    {
      source: "/:locale/about",
      destination: "/:locale",
      permanent: true,
    },
  ];
  const redirects = [
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

  return [
    ...rootRedirects,
    ...redirects.flatMap(({ source, destination, permanent }) => {
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
    }),
  ];
}

/**
 * Return the shared security headers for all application responses.
 */
function createAppHeaders() {
  return [
    {
      source: "/:path*",
      headers: [...createSecurityHeaders(), ...AGENT_DISCOVERY_HEADERS],
    },
  ];
}

const nextConfig = {
  ...config,
  cacheComponents: true,
  cacheLife: {
    contentRuntime: {
      stale: 300,
      revalidate: 86_400,
      expire: 604_800,
    },
  },
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
    "/llms.mdx/[...slug]": [
      "./app/[locale]/(app)/(shared)/(site)/(legal)/**/*.mdx",
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
  configEnv.ANALYZE === "true" ? withAnalyzer(nextConfig) : nextConfig;

export default withMDX(withNextIntl(analyzedConfig));
