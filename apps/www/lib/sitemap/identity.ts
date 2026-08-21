import { isProjectionBucket } from "@repo/backend/convex/contentRelease/bucket";
import { routing } from "@repo/internationalization/src/routing";
import { hasLocale, type Locale } from "next-intl";

/** One canonical sitemap XML page identity. */
export type SitemapPage =
  | { id: typeof SITEMAP_BASE_ID }
  | {
      bucket: string;
      id: string;
      kind: "article";
      locale: Locale;
    }
  | {
      bucket: string;
      id: string;
      kind: "material";
      locale: Locale;
    }
  | {
      bucket: string;
      id: string;
      kind: "program";
      locale: Locale;
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

/** Formats one deterministic published-article sitemap page id. */
export function formatArticlePage(bucket: string, locale: Locale) {
  return `article_${locale}_${bucket}`;
}

/** Formats one deterministic published-material sitemap page id. */
export function formatMaterialPage(bucket: string, locale: Locale) {
  return `material_${locale}_${bucket}`;
}

/** Formats one deterministic published-program sitemap page id. */
export function formatProgramPage(bucket: string, locale: Locale) {
  return `program_${locale}_${bucket}`;
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

  if (prefix === "quran") {
    return segments.length === 2 ? { id, kind: "quran", locale } : null;
  }

  if (prefix === "page") {
    return segments.length === 2 ? { id, kind: "page", locale } : null;
  }

  if (prefix === "tryout") {
    if (segments.length !== 3) {
      return null;
    }
    const page = parsePageNumber(segments[2]);
    if (page === null) {
      return null;
    }
    return { id, kind: prefix, locale, page };
  }

  if (prefix === "article") {
    const bucket = segments[2];
    if (segments.length !== 3 || !bucket || !isProjectionBucket(bucket)) {
      return null;
    }
    return { bucket, id, kind: "article", locale };
  }
  if (prefix === "material") {
    const bucket = segments[2];
    if (segments.length !== 3 || !bucket || !isProjectionBucket(bucket)) {
      return null;
    }
    return { bucket, id, kind: "material", locale };
  }
  if (prefix === "program") {
    const bucket = segments[2];
    if (segments.length !== 3 || !bucket || !isProjectionBucket(bucket)) {
      return null;
    }
    return { bucket, id, kind: "program", locale };
  }

  return null;
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
