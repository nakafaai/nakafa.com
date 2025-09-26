import { getAllSeoDomains } from "@repo/next-config/domains";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: [
      "https://nakafa.com/sitemap.xml",
      ...getAllSeoDomains().map((domain) => `https://${domain}/sitemap.xml`),
    ],
  };
}
