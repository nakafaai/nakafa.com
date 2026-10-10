import { SITE_ORIGIN } from "@repo/seo/origin";
import type { MetadataRoute } from "next";

/** Generates robots.txt with the canonical sitemap index URL. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
