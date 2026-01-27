import { config, withAnalyzer, withMDX } from "@repo/next-config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { env } from "@/env";

const withNextIntl = createNextIntlPlugin(
  "../../packages/internationalization/src/request.ts"
);

/**
 * Security headers configuration
 * Implements best practices for web security
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.convex.cloud https://*.convex.site https://*.vercel-analytics.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
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
      "speaker=()",
      "sync-xhr=()",
    ].join(", "),
  },
];

let nextConfig: NextConfig = {
  ...config,
  serverExternalPackages: ["@takumi-rs/image-response"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  async rewrites() {
    await Promise.resolve();
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
    await Promise.resolve();

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
