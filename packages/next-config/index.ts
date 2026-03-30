import withBundleAnalyzer from "@next/bundle-analyzer";
import createMdx from "@next/mdx";
import type { NextConfig } from "next";

/**
 * Security headers configuration
 * Implements best practices for web security
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
 */
export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com https://eu-assets.i.posthog.com https://va.vercel-scripts.com https://accounts.google.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com https://cdn.jsdelivr.net",
      "img-src 'self' blob: data: https: https://*.googleusercontent.com",
      "font-src 'self'",
      "connect-src 'self' wss://*.convex.cloud https://*.convex.cloud https://*.convex.site https://*.vercel-analytics.com https://*.posthog.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://accounts.google.com https://www.youtube-nocookie.com https://www.youtube.com",
      "frame-src 'self' https://accounts.google.com https://www.youtube-nocookie.com https://www.youtube.com",
      "media-src 'self' https://*.convex.cloud https://cdn.islamic.network",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "manifest-src 'self' https://nakafa.com",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "sync-xhr=()",
    ].join(", "),
  },
];

export const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  pageExtensions: ["mdx", "tsx", "ts", "jsx", "js"],
  reactCompiler: true,
  serverExternalPackages: ["shiki", "pino"],
  experimental: {
    optimizePackageImports: ["three"],
  },
  images: {
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        hostname: "www.google.com",
      },
      {
        hostname: "lh3.googleusercontent.com",
      },
      {
        hostname: "*.convex.cloud",
      },
    ],
  },
  headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);

/**
 * Applies the shared MDX configuration used across Next.js apps in the
 * monorepo.
 *
 * Next and MDX document remark plugins as markdown-tree transforms and rehype
 * plugins as HTML-tree transforms. We intentionally keep only markdown-stage
 * plugins here, because the MDX compiler already performs the mdast -> hast
 * bridge internally and `remark-rehype` is not required for the default MDX
 * pipeline.
 *
 * @param sourceConfig - Base Next.js configuration to augment with MDX support
 * @returns Next.js configuration with MDX enabled
 */
export const withMDX = (sourceConfig: NextConfig): NextConfig =>
  createMdx({
    options: {
      remarkPlugins: [
        "remark-gfm",
        ["remark-math", { singleDollarTextMath: false }],
      ],
    },
  })(sourceConfig);
