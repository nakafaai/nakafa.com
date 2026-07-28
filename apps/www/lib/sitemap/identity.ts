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
      id: string;
      kind: "public";
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

/** Formats one bounded public-context sitemap page id. */
export function formatPublicPage(locale: Locale, page: number) {
  return `public_${locale}_${page}`;
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

  if (prefix === "public") {
    if (segments.length !== 3) {
      return null;
    }
    const page = parsePageNumber(segments[2]);
    return page === null ? null : { id, kind: "public", locale, page };
  }

  if (prefix === "article") {
    const bucket = segments[2];
    if (segments.length !== 3 || !bucket || !isProjectionBucket(bucket)) {
      return null;
    }
    return { bucket, id, kind: "article", locale };
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

/** Checks whether one page targets public route rows. */
export function isPublicSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "public" }> {
  return "kind" in page && page.kind === "public";
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
