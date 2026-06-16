import type { MetadataRoute } from "next";

type SitemapEntry = MetadataRoute.Sitemap[number];

export const sitemapXmlHeaders = {
  "Cache-Control":
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "application/xml; charset=utf-8",
} as const;

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

/** Serializes bounded sitemap page URLs into a sitemap index document. */
export function buildSitemapIndexXml(urls: readonly string[]) {
  const sitemapLines = urls.map(
    (url) => `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n  </sitemap>`
  );

  return [
    xmlHeader,
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapLines,
    "</sitemapindex>",
    "",
  ].join("\n");
}

/** Serializes one bounded sitemap URL page into a sitemap URL set document. */
export function buildSitemapUrlSetXml(entries: readonly SitemapEntry[]) {
  const urlLines = entries.map(formatSitemapEntry);

  return [
    xmlHeader,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urlLines,
    "</urlset>",
    "",
  ].join("\n");
}

/** Formats one sitemap entry including optional alternates and metadata. */
function formatSitemapEntry(entry: SitemapEntry) {
  const lines = ["  <url>", `    <loc>${escapeXml(entry.url)}</loc>`];
  const lastModified = formatLastModified(entry.lastModified);

  if (lastModified) {
    lines.push(`    <lastmod>${escapeXml(lastModified)}</lastmod>`);
  }

  if (entry.changeFrequency) {
    lines.push(
      `    <changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`
    );
  }

  if (typeof entry.priority === "number") {
    lines.push(`    <priority>${entry.priority}</priority>`);
  }

  const languages = entry.alternates?.languages;
  if (languages) {
    for (const [language, href] of Object.entries(languages)) {
      if (!href) {
        continue;
      }

      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(String(href))}" />`
      );
    }
  }

  lines.push("  </url>");

  return lines.join("\n");
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
