import { config, withAnalyzer, withMDX } from "@repo/next-config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { env } from "@/env";

const withNextIntl = createNextIntlPlugin(
  "../../packages/internationalization/src/request.ts"
);

let nextConfig: NextConfig = {
  ...config,
  serverExternalPackages: ["@takumi-rs/image-response"],
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
