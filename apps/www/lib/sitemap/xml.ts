import { Array as Arr } from "effect";
import type { MetadataRoute } from "next";
import { CONTENT_SITEMAP_CACHE_TAG } from "@/lib/sitemap/cache";

type SitemapEntry = MetadataRoute.Sitemap[number];

export const sitemapXmlHeaders = {
  "Cache-Control":
    "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
  "Content-Type": "application/xml; charset=utf-8",
  "Vercel-Cache-Tag": CONTENT_SITEMAP_CACHE_TAG,
} as const;

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

/** Serializes bounded sitemap page URLs into a sitemap index document. */
export function buildSitemapIndexXml(urls: readonly string[]) {
  const sitemapLines = Arr.map(
    urls,
    (url) => `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n  </sitemap>`
  );

  return Arr.join(
    [
      xmlHeader,
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...sitemapLines,
      "</sitemapindex>",
      "",
    ],
    "\n"
  );
}

/** Serializes one bounded sitemap URL page into a sitemap URL set document. */
export function buildSitemapUrlSetXml(entries: readonly SitemapEntry[]) {
  const urlLines = Arr.map(entries, formatSitemapEntry);

  return Arr.join(
    [
      xmlHeader,
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urlLines,
      "</urlset>",
      "",
    ],
    "\n"
  );
}

/** Formats one sitemap entry with an optional truthful modification date. */
function formatSitemapEntry(entry: SitemapEntry) {
  const lastModified = formatLastModified(entry.lastModified);

  return Arr.join(
    [
      "  <url>",
      `    <loc>${escapeXml(entry.url)}</loc>`,
      ...(lastModified
        ? [`    <lastmod>${escapeXml(lastModified)}</lastmod>`]
        : []),
      "  </url>",
    ],
    "\n"
  );
}

/** Converts sitemap date values into XML timestamp text. */
function formatLastModified(value: Date | string | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

/** Escapes text for XML element and attribute values. */
function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
