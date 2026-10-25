import { Array as Arr, Schema } from "effect";

/** One `hreflang` alternate link of a sitemap URL. */
const SitemapAlternate = Schema.Struct({
  hreflang: Schema.String,
  href: Schema.String,
});

/** One sitemap URL, with its alternates and the modification date that the XML writes when it is known. */
const SitemapEntry = Schema.Struct({
  alternates: Schema.optionalKey(Schema.Array(SitemapAlternate)),
  lastModified: Schema.optionalKey(Schema.Union([Schema.Date, Schema.String])),
  url: Schema.String,
});

type SitemapEntry = typeof SitemapEntry.Type;

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
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ...urlLines,
      "</urlset>",
      "",
    ],
    "\n"
  );
}

/** Formats one sitemap entry with its alternate links and an optional truthful modification date. */
function formatSitemapEntry(entry: SitemapEntry) {
  const lastModified = formatLastModified(entry.lastModified);

  return Arr.join(
    [
      "  <url>",
      `    <loc>${escapeXml(entry.url)}</loc>`,
      ...Arr.map(entry.alternates ?? [], formatAlternate),
      ...(lastModified
        ? [`    <lastmod>${escapeXml(lastModified)}</lastmod>`]
        : []),
      "  </url>",
    ],
    "\n"
  );
}

/** Formats one `hreflang` alternate link in the XHTML namespace the URL set declares. */
function formatAlternate(alternate: typeof SitemapAlternate.Type) {
  return `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}" />`;
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
