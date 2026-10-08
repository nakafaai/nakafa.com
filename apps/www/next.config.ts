import path from "node:path";
import { postHogProxyKeys } from "@repo/analytics/keys";
import { createPostHogProxyRewrites } from "@repo/analytics/posthog/config";
import {
  config,
  createLoopbackConnectSources,
  createSecurityHeaders,
} from "@repo/next-config";
import {
  hasPreviewProvider,
  hasPreviewRenderer,
} from "@repo/next-config/preview";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import {
  CONTENT_CACHE_LIFETIME,
  CONTENT_CACHE_PROFILE,
} from "@/lib/content/profile";
import { AGENT_DISCOVERY_HEADERS } from "@/lib/discovery";
import { createOgRouteAliasRewrites } from "@/lib/og/route";
import { readRuntimeConfig } from "@/runtime";

const runtime = readRuntimeConfig();
const configEnv = createEnv({
  server: {
    NEXT_EXPOSE_TESTING_API: Schema.toStandardSchemaV1(
      Schema.UndefinedOr(Schema.Literal("true"))
    ),
    PORTLESS_URL: Schema.toStandardSchemaV1(
      Schema.UndefinedOr(Schema.URLFromString)
    ),
  },
  client: {},
  runtimeEnv: {
    NEXT_EXPOSE_TESTING_API: process.env.NEXT_EXPOSE_TESTING_API,
    PORTLESS_URL: process.env.PORTLESS_URL,
  },
});
const localConvexConnectSources = createLoopbackConnectSources(
  new URL(runtime.query)
);
const isAksaraPreviewChild = hasPreviewProvider() || hasPreviewRenderer();
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
          additionalConnectSources: [...localConvexConnectSources],
          additionalImageSources: localConvexConnectSources.filter((source) =>
            source.startsWith("http:")
          ),
        }),
        ...AGENT_DISCOVERY_HEADERS,
      ],
    },
  ];
}
const nextConfig = {
  ...config,
  // Permit HMR only from the exact origin assigned by this Portless process.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  ...(configEnv.PORTLESS_URL
    ? { allowedDevOrigins: [configEnv.PORTLESS_URL.hostname] }
    : {}),
  cacheComponents: true,
  partialPrefetching: true,
  // Keep React's preloads in the HTML. React moves them into a Link header
  // while that header has room, and a page generated on demand from its
  // fallback shell stores the header before content inside Suspense renders,
  // so the fonts a lesson's math preloads would never reach its cached page.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/reactMaxHeadersLength
  reactMaxHeadersLength: 0,
  typescript: {
    // pnpm build runs next typegen and the full two-checker tsc gate first.
    // Keep that check outside the resident web compiler's memory footprint.
    // https://nextjs.org/docs/app/api-reference/config/next-config-js/typescript
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_AKSARA_PREVIEW_CHILD: `${isAksaraPreviewChild}`,
  },
  // Signed content reads share one freshness policy with the publication
  // invalidation that refreshes them, so both live in one module.
  cacheLife: {
    [CONTENT_CACHE_PROFILE]: { ...CONTENT_CACHE_LIFETIME },
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
  // The image routes read the logo through Effect's FileSystem, which the
  // file tracer cannot follow, so the trace names the file. Without it the
  // deployed function has no logo and answers 500.
  // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats
  outputFileTracingIncludes: {
    "/og/*": ["./public/logo.svg"],
    "/*/og/*": ["./public/logo.svg"],
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
    // Keep completed payloads keyed by concrete URL parameters. Runtime
    // metadata can omit vary parameters and otherwise leak across lessons.
    // https://github.com/vercel/next.js/pull/97804
    varyParams: false,
    // Cold builds must fit the 8 GB production builder without retaining the
    // persistent compiler graph for disk-cache serialization.
    // https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache
    turbopackFileSystemCacheForBuild: false,
    // A page whose render returns an error gets this many attempts, each with
    // its own 60 second budget, so one failed content read does not end the
    // build. Next 16.4.0 counts attempts rather than retries: the export worker
    // loops while `attempt < maxAttempts` (next/dist/export/worker.js), so 2
    // allows one retry. The option defaults to undefined, one attempt
    // (next/dist/server/config-shared.js).
    // https://nextjs.org/docs/app/api-reference/config/next-config-js/staticGeneration
    staticGenerationRetryCount: 2,
    ...(configEnv.NEXT_EXPOSE_TESTING_API === "true"
      ? { exposeTestingApiInProductionBuild: true }
      : {}),
    globalNotFound: true,
    instantInsights: {
      validationLevel: "warning",
    },
  },
} satisfies NextConfig;
export default withNextIntl(nextConfig);
