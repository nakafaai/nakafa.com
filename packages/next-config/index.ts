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
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com https://eu-assets.i.posthog.com https://va.vercel-scripts.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "img-src 'self' blob: data: https: https://*.googleusercontent.com",
      "font-src 'self'",
      "connect-src 'self' wss://*.convex.cloud https://*.convex.cloud https://*.convex.site https://*.vercel-analytics.com https://*.posthog.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "manifest-src 'self'",
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

export const withMDX = (sourceConfig: NextConfig): NextConfig =>
  createMdx({
    options: {
      remarkPlugins: [
        "remark-gfm",
        ["remark-math", { singleDollarTextMath: false }],
        "remark-rehype",
      ],
    },
  })(sourceConfig);
