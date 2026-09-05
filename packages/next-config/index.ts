import type { NextConfig } from "next";

const BASE_CONTENT_SECURITY_POLICY = {
  connectSrc: [
    "'self'",
    "wss://*.convex.cloud",
    "https://*.convex.cloud",
    "https://*.convex.site",
    "https://accounts.google.com",
    "https://cdn.jsdelivr.net",
    "https://www.youtube-nocookie.com",
    "https://www.youtube.com",
  ],
  mediaSrc: ["'self'", "https://*.convex.cloud", "https://cdn.islamic.network"],
  scriptSrc: [
    "'self'",
    "'unsafe-eval'",
    "'unsafe-inline'",
    "blob:",
    "https://unpkg.com",
    "https://accounts.google.com",
    "https://cdn.jsdelivr.net",
  ],
} as const;

/**
 * Returns the exact loopback origins required by a local Convex Agent Mode
 * client without widening production network access.
 *
 * References:
 * https://docs.convex.dev/cli/agent-mode
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src
 */
export function createLoopbackConnectSources(source: URL) {
  const isLoopback =
    source.hostname === "127.0.0.1" ||
    source.hostname === "localhost" ||
    source.hostname === "[::1]";

  if (source.protocol !== "http:" || !isLoopback) {
    return [];
  }

  const webSocketSource = new URL(source);
  webSocketSource.protocol = "ws:";

  return [source.origin, webSocketSource.origin];
}

/**
 * Builds the shared security headers used by the Next.js apps in this repo.
 *
 * PostHog traffic is routed through a same-origin proxy path, so the default
 * `'self'` sources already cover analytics scripts and network requests.
 *
 * References:
 * https://posthog.com/docs/advanced/content-security-policy
 * https://posthog.com/docs/advanced/proxy/nextjs
 */
export function createSecurityHeaders({
  additionalConnectSources = [],
}: {
  readonly additionalConnectSources?: readonly string[];
} = {}) {
  return [
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        `script-src ${BASE_CONTENT_SECURITY_POLICY.scriptSrc.join(" ")}`,
        "style-src 'self' 'unsafe-inline' https://accounts.google.com https://cdn.jsdelivr.net",
        "img-src 'self' blob: data: https: https://*.googleusercontent.com",
        "font-src 'self'",
        `connect-src ${[
          ...BASE_CONTENT_SECURITY_POLICY.connectSrc,
          ...additionalConnectSources,
        ].join(" ")}`,
        "frame-src 'self' https://accounts.google.com https://www.youtube-nocookie.com https://www.youtube.com",
        `media-src ${BASE_CONTENT_SECURITY_POLICY.mediaSrc.join(" ")}`,
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
}

/**
 * Security headers configuration
 * Implements best practices for web security
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
 */
export const securityHeaders = createSecurityHeaders();

export const config = {
  // The monorepo root owns the canonical agent guidance. Prevent each Next.js
  // app from generating a redundant nested AGENTS.md and CLAUDE.md pair.
  agentRules: false,
  reactStrictMode: true,
  typedRoutes: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  reactCompiler: true,
  serverExternalPackages: ["shiki"],
  experimental: {
    optimizePackageImports: ["three"],
    useTypeScriptCli: true,
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
} satisfies NextConfig;
