import withBundleAnalyzer from "@next/bundle-analyzer";
import createMdx from "@next/mdx";
import type { NextConfig } from "next";

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
