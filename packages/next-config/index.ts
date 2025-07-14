import withBundleAnalyzer from "@next/bundle-analyzer";
import createMDX from "@next/mdx";

import type { NextConfig } from "next";

export const config: NextConfig = {
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  pageExtensions: ["mdx", "ts", "tsx"],
  experimental: {
    mdxRs: {
      mdxType: "gfm",
    },
    optimizePackageImports: ["three"],
    reactCompiler: true,
  },
  images: {
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async rewrites() {
    await Promise.resolve();
    const llmSource = ["/:path*.md", "/:path*.mdx", "/:path*/llms.txt"];
    const llmDestination = "/llms.mdx/:path*";
    return [
      ...llmSource.map((source) => ({
        source,
        destination: llmDestination,
      })),
    ];
  },

  async redirects() {
    await Promise.resolve();
    return [
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
        source: "/discord",
        destination: "https://discord.gg/CPCSfKhvfQ",
        permanent: false,
      },
    ];
  },
};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);

export const withMDX = (sourceConfig: NextConfig): NextConfig =>
  createMDX()(sourceConfig);
