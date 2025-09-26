import { isSeoDomain } from "@repo/next-config/domains";
import type { NextRequest } from "next/server";
import {
  baseRoutes,
  getAskRoutes,
  getContentRoutes,
  getEntries,
  getOgRoutes,
  getQuranRoutes,
} from "../sitemap";

export async function GET(request: NextRequest) {
  // Get the original host from the header (set by middleware)
  const hostname =
    request.headers.get("x-original-host") || request.nextUrl.hostname;

  // Check if this is a valid SEO domain
  if (!isSeoDomain(hostname)) {
    return new Response("Not Found", { status: 404 });
  }

  // Generate routes
  const contentRoutes = getContentRoutes();
  const ogRoutes = getOgRoutes(contentRoutes);
  const quranRoutes = getQuranRoutes();
  const askRoutes = getAskRoutes();

  const allBaseRoutes = [
    ...baseRoutes,
    ...contentRoutes,
    ...ogRoutes,
    ...quranRoutes,
    ...askRoutes,
  ];

  // Generate sitemap entries for this specific domain
  const sitemapEntriesPromises = allBaseRoutes.map(
    async (route) => await getEntries(route, hostname)
  );

  const sitemapEntriesArrays = await Promise.all(sitemapEntriesPromises);
  const sitemapEntries = sitemapEntriesArrays.flat();

  // Add homepage entry for this domain
  const homeEntries = await getEntries("/", hostname);
  const allEntries = [...homeEntries, ...sitemapEntries];

  // Generate XML sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allEntries
  .map(
    (entry) => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
    ${
      entry.alternates?.languages
        ? Object.entries(entry.alternates.languages)
            .map(
              ([lang, url]) =>
                `    <xhtml:link rel="alternate" hreflang="${lang}" href="${url}" />`
            )
            .join("\n")
        : ""
    }
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=86400, stale-while-revalidate",
    },
  });
}
