import { SEO_DOMAINS } from "@repo/next-config/domains";
import type { MetadataRoute } from "next";
import { getSitemapPageDescriptors } from "@/lib/sitemap/routes";

const primaryDomain = "nakafa.com";

/** Generates robots.txt with links to every bounded sitemap page. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitemapIds = (await getSitemapPageDescriptors()).map(
    (descriptor) => descriptor.id
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: buildSitemapUrls(sitemapIds),
  };
}

/** Builds canonical sitemap page URLs for the primary and SEO domains. */
function buildSitemapUrls(sitemapIds: readonly string[]) {
  const urls: string[] = [];

  for (const domain of getSitemapDomains()) {
    for (const id of sitemapIds) {
      urls.push(`https://${domain}/sitemap/${id}.xml`);
    }
  }

  return urls;
}

/** Returns every domain that should advertise sitemap pages. */
function getSitemapDomains() {
  return [primaryDomain, ...SEO_DOMAINS].filter(
    (domain, index, domains) => domains.indexOf(domain) === index
  );
}
