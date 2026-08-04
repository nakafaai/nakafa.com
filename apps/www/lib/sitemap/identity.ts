import type { api } from "@repo/backend/convex/_generated/api";
import { isProjectionBucket } from "@repo/backend/convex/contentRelease/bucket";
import { routing } from "@repo/internationalization/src/routing";
import type { FunctionArgs } from "convex/server";
import { hasLocale, type Locale } from "next-intl";

/** Runtime content sections materialized by the source-backed route projection. */
export type RuntimeContentSection = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>["section"];

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
      id: string;
      kind: "content";
      locale: Locale;
      page: number;
      section: RuntimeContentSection;
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
  | {
      id: string;
      kind: "public";
      locale: Locale;
      page: number;
    }
  | {
      id: string;
      kind: "tryout";
      locale: Locale;
      page: number;
    };

const contentSections: readonly RuntimeContentSection[] = [
  "articles",
  "material",
  "tryout",
  "quran",
];

/** Stable identity for the sitemap containing application-level routes. */
export const SITEMAP_BASE_ID = "base";

/** Formats one deterministic published-article sitemap page id. */
export function formatArticlePage(bucket: string, locale: Locale) {
  return `article_${locale}_${bucket}`;
}

/** Formats one materialized content route sitemap page id. */
export function formatContentPage(
  locale: Locale,
  section: RuntimeContentSection,
  page: number
) {
  return `content_${locale}_${section}_${page}`;
}

/** Formats one deterministic published-material sitemap page id. */
export function formatMaterialPage(bucket: string, locale: Locale) {
  return `material_${locale}_${bucket}`;
}

/** Formats one deterministic published-program sitemap page id. */
export function formatProgramPage(bucket: string, locale: Locale) {
  return `program_${locale}_${bucket}`;
}

/** Formats one bounded public-context sitemap page id. */
export function formatPublicPage(locale: Locale, page: number) {
  return `public_${locale}_${page}`;
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

  if (prefix === "public" || prefix === "tryout") {
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

  const section = segments[2];
  if (
    prefix !== "content" ||
    segments.length !== 4 ||
    !isRuntimeContentSection(section)
  ) {
    return null;
  }
  const page = parsePageNumber(segments[3]);
  return page === null ? null : { id, kind: "content", locale, page, section };
}

/** Checks whether one page targets graph-backed content rows. */
export function isContentSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "content" }> {
  return "kind" in page && page.kind === "content";
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

/** Checks whether one page targets public route rows. */
export function isPublicSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "public" }> {
  return "kind" in page && page.kind === "public";
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

/** Checks whether one raw route segment names a content section. */
function isRuntimeContentSection(
  section: string | undefined
): section is RuntimeContentSection {
  return contentSections.some((candidate) => candidate === section);
}
