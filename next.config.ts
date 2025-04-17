import createBundleAnalyzer from "@next/bundle-analyzer";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "./i18n";

const withAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin();

const withMDX = createMDX();

const nextConfig: NextConfig = {
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
  },
  images: {
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async redirects() {
    await Promise.resolve();
    return routing.locales.flatMap((locale) => [
      {
        source: `/${locale}/subject/junior-high-school/:path*`,
        destination: `/${locale}/subject/middle-school/:path*`,
        permanent: true,
      },
      {
        source: `/${locale}/subject/senior-high-school/:path*`,
        destination: `/${locale}/subject/high-school/:path*`,
        permanent: true,
      },
    ]);
  },
};

export default withAnalyzer(withNextIntl(withMDX(nextConfig)));
