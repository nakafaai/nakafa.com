import { MAIN_DOMAIN } from "@repo/next-config/domains";
import type { MetadataRoute } from "next";

/** Generates robots.txt with the canonical sitemap index URL. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `https://${MAIN_DOMAIN}/sitemap.xml`,
  };
}
