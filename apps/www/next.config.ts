import path from "node:path";
import { postHogProxyKeys } from "@repo/analytics/keys";
import { createPostHogProxyRewrites } from "@repo/analytics/posthog/config";
import { convexKeys } from "@repo/backend/keys";
import { hasCandidateLocalePreview } from "@repo/internationalization/src/environment";
import {
  config,
  createLoopbackConnectSources,
  createSecurityHeaders,
  withAnalyzer,
  withMDX,
} from "@repo/next-config";
import { analyzeKeys } from "@repo/next-config/keys";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { AGENT_DISCOVERY_HEADERS } from "@/lib/agent-discovery";
import { hasPreviewRendererEnvironment } from "@/lib/content/preview/environment";
import { createOgRouteAliasRewrites } from "@/lib/og/route";

const configEnv = createEnv({
  extends: [analyzeKeys(), convexKeys()],
  server: {
    CONVEX_AGENT_MODE: Schema.toStandardSchemaV1(
      Schema.UndefinedOr(Schema.Literal("anonymous"))
    ),
    NEXT_EXPOSE_TESTING_API: Schema.toStandardSchemaV1(
      Schema.UndefinedOr(Schema.Literal("true"))
    ),
    VERCEL: Schema.toStandardSchemaV1(Schema.UndefinedOr(Schema.Literal("1"))),
  },
  runtimeEnv: {
    CONVEX_AGENT_MODE: process.env.CONVEX_AGENT_MODE,
    NEXT_EXPOSE_TESTING_API: process.env.NEXT_EXPOSE_TESTING_API,
    VERCEL: process.env.VERCEL,
  },
});
const localConvexConnectSources = createLoopbackConnectSources(
  new URL(configEnv.NEXT_PUBLIC_CONVEX_URL)
);
const isAksaraPreviewChild =
  hasCandidateLocalePreview() || hasPreviewRendererEnvironment();
const postHogProxyEnv = isAksaraPreviewChild ? null : postHogProxyKeys();
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
    ...createOgRouteAliasRewrites(),
  ];
  return {
    // PostHog requires the specific static and array rewrites to come before the
    // catch-all analytics rewrite so asset cache headers are preserved.
    afterFiles: [
      ...(postHogProxyEnv === null
        ? []
        : createPostHogProxyRewrites(postHogProxyEnv.POSTHOG_PROXY_HOST)),
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
      destination: COMPANY_SOCIAL_PROFILES.discord,
      permanent: false,
    },
    {
      source: "/community",
      destination: COMPANY_SOCIAL_PROFILES.discord,
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
      headers: [
        ...createSecurityHeaders({
          additionalConnectSources: [
            "https://raw.githubusercontent.com",
            ...localConvexConnectSources,
          ],
        }),
        ...AGENT_DISCOVERY_HEADERS,
      ],
    },
  ];
}
const nextConfig = {
  ...config,
  cacheComponents: true,
  partialPrefetching: true,
  // The Vercel command completes an isolated app typecheck before `next build`.
  // Repeating static analysis after Turbopack compilation retained enough
  // memory to exceed Vercel's build limit on every cold-cache production build.
  // Local and CI builds keep Next's built-in typecheck as an independent gate.
  // https://nextjs.org/docs/app/guides/memory-usage#disable-static-analysis
  typescript: {
    ignoreBuildErrors: configEnv.VERCEL === "1",
  },
  // Cache Components enables prerender source maps by default. The anonymous
  // CI build does not publish those artifacts, and retaining them exhausted
  // the static worker's isolated 4 GiB heap with two pages in flight.
  // Production keeps source maps enabled. Docs:
  // https://nextjs.org/docs/app/guides/memory-usage#disable-source-maps
  ...(configEnv.CONVEX_AGENT_MODE === "anonymous"
    ? { enablePrerenderSourceMaps: false }
    : {}),
  env: {
    NEXT_PUBLIC_AKSARA_PREVIEW_CHILD: `${isAksaraPreviewChild}`,
  },
  cacheLife: {
    contentRuntime: {
      stale: 300,
      revalidate: 3600,
      expire: 86_400,
    },
  },
  // PostHog's same-origin proxy endpoints include trailing slashes such as
  // `/i/v0/e/`, so Next.js slash normalization must be disabled.
  skipTrailingSlashRedirect: true,
  // Proxy negotiates public document representations, so it must receive the
  // `rsc: 1` marker that Next.js otherwise strips with Flight headers.
  // Docs: https://nextjs.org/docs/app/api-reference/file-conventions/proxy#rsc-requests-and-rewrites
  skipProxyUrlNormalize: true,
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
    ...(configEnv.NEXT_EXPOSE_TESTING_API === "true"
      ? { exposeTestingApiInProductionBuild: true }
      : {}),
    globalNotFound: true,
    instantInsights: {
      validationLevel: "warning",
    },
    // Anonymous Convex shares this runner. Split the export across two isolated
    // worker heaps, but let each worker process only one page at a time so the
    // backend sees at most two concurrent static-generation requests. Retry one
    // complete page after an intermittent local-backend response; repeated or
    // deterministic page failures still fail the build.
    // Production keeps Next.js' default static-generation concurrency.
    // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/staticGeneration
    ...(configEnv.CONVEX_AGENT_MODE === "anonymous"
      ? {
          cpus: 2,
          staticGenerationMaxConcurrency: 1,
          staticGenerationRetryCount: 2,
        }
      : {}),
  },
} satisfies NextConfig;
const analyzedConfig =
  configEnv.ANALYZE === "true" ? withAnalyzer(nextConfig) : nextConfig;
export default withMDX(withNextIntl(analyzedConfig));
