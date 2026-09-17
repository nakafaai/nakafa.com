import { routing } from "@repo/internationalization/src/routing";
import { hasLocale, type Locale } from "next-intl";

/** One canonical sitemap XML page identity. */
export type SitemapPage =
  | { id: typeof SITEMAP_BASE_ID }
  | {
      id: string;
      kind: "article";
      locale: Locale;
      partition: number;
    }
  | {
      id: string;
      kind: "material";
      locale: Locale;
      partition: number;
    }
  | {
      id: string;
      kind: "program";
      locale: Locale;
      partition: number;
    }
  | { id: string; kind: "page"; locale: Locale }
  | { id: string; kind: "quran"; locale: Locale }
  | {
      id: string;
      kind: "tryout";
      locale: Locale;
      page: number;
    };

/** Stable identity for the sitemap containing application-level routes. */
export const SITEMAP_BASE_ID = "base";

/** Content families served through capacity-owned sitemap partitions. */
export type SitemapFamily = "article" | "material" | "program";

/** Prefix marking one capacity-owned sitemap partition index. */
const PARTITION_PREFIX = "p";

/** Formats one capacity-owned published-article sitemap partition id. */
export function formatArticlePartition(locale: Locale, partition: number) {
  return `article_${locale}_${PARTITION_PREFIX}${partition}`;
}

/** Formats one capacity-owned published-material sitemap partition id. */
export function formatMaterialPartition(locale: Locale, partition: number) {
  return `material_${locale}_${PARTITION_PREFIX}${partition}`;
}

/** Formats one capacity-owned published-program sitemap partition id. */
export function formatProgramPartition(locale: Locale, partition: number) {
  return `program_${locale}_${PARTITION_PREFIX}${partition}`;
}

/** Formats the complete signed Page sitemap identity for one locale. */
export function formatPagePage(locale: Locale) {
  return `page_${locale}`;
}

/** Formats the bounded signed Quran sitemap page id. */
export function formatQuranPage(locale: Locale) {
  return `quran_${locale}`;
}

/** Formats one bounded signed try-out sitemap page id. */
export function formatTryoutPage(locale: Locale, page: number) {
  return `tryout_${locale}_${page}`;
}

/** Parses one canonical sitemap page identity. */
export function getSitemapPageDescriptor(id: string): SitemapPage | null {
  if (id === SITEMAP_BASE_ID) {
    return { id: SITEMAP_BASE_ID };
  }

  const segments = id.split("_");
  const [prefix, locale] = segments;

  if (!hasLocale(routing.locales, locale)) {
    return null;
  }

  if (prefix === "quran" || prefix === "page") {
    return segments.length === 2 ? { id, kind: prefix, locale } : null;
  }

  if (segments.length !== 3) {
    return null;
  }
  if (prefix === "tryout") {
    const page = parsePageNumber(segments[2]);
    if (page === null) {
      return null;
    }
    return { id, kind: prefix, locale, page };
  }

  if (
    !(prefix === "article" || prefix === "material" || prefix === "program")
  ) {
    return null;
  }
  return describePartitionSitemapPage(prefix, id, locale, segments[2]);
}

/** Describes one capacity-owned family sitemap partition page. */
function describePartitionSitemapPage(
  kind: SitemapFamily,
  id: string,
  locale: Locale,
  segment: string | undefined
): SitemapPage | null {
  const partition = parsePartitionNumber(segment);
  if (partition === null) {
    return null;
  }
  if (kind === "article") {
    return { id, kind, locale, partition };
  }
  if (kind === "material") {
    return { id, kind, locale, partition };
  }
  return { id, kind, locale, partition };
}

/** Checks whether one page targets published article rows. */
export function isArticleSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "article" }> {
  return "kind" in page && page.kind === "article";
}

/** Checks whether one page targets published material rows. */
export function isMaterialSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "material" }> {
  return "kind" in page && page.kind === "material";
}

/** Checks whether one page targets published curriculum rows. */
export function isProgramSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "program" }> {
  return "kind" in page && page.kind === "program";
}

/** Checks whether one sitemap page targets signed public Pages. */
export function isPageSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "page" }> {
  return "kind" in page && page.kind === "page";
}

/** Checks whether one page targets the signed Quran catalog. */
export function isQuranSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "quran" }> {
  return "kind" in page && page.kind === "quran";
}

/** Checks whether one page targets signed try-out routes. */
export function isTryoutSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "tryout" }> {
  return "kind" in page && page.kind === "tryout";
}

/** Parses one canonical non-negative sitemap page number. */
function parsePageNumber(segment: string | undefined) {
  if (!segment) {
    return null;
  }
  const page = Number(segment);
  if (!Number.isSafeInteger(page) || page < 0 || String(page) !== segment) {
    return null;
  }
  return page;
}

/** Parses one canonical capacity-owned partition suffix such as `p0`. */
function parsePartitionNumber(segment: string | undefined) {
  if (!segment?.startsWith(PARTITION_PREFIX)) {
    return null;
  }
  return parsePageNumber(segment.slice(PARTITION_PREFIX.length));
}
