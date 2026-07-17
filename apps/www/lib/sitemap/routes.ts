import type { api } from "@repo/backend/convex/_generated/api";
import { CONTENT_SITEMAP_ROUTE_PAGE_SIZE } from "@repo/backend/convex/contents/sitemap/spec";
import { routing } from "@repo/internationalization/src/routing";
import type { FunctionArgs } from "convex/server";
import { Data, Effect } from "effect";
import { hasLocale, type Locale } from "next-intl";
import {
  getRuntimeContentRouteCounts,
  getRuntimeContentSitemapPage,
  getRuntimePublicSitemapCount,
  getRuntimePublicSitemapPage,
} from "@/lib/content/runtime/routes";
import { buildSitemapContentPageRoutes } from "@/lib/sitemap/content";

type RuntimeContentSection = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>["section"];
const contentSections: readonly RuntimeContentSection[] = [
  "articles",
  "material",
  "tryout",
  "quran",
];
const sitemapBasePageId = "base";
const quranRootRoute = "/quran";

type SitemapPage =
  | { id: typeof sitemapBasePageId }
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

/** Descriptor for one graph-backed sitemap artifact page. */
type ContentSitemapPage = Extract<SitemapPage, { kind: "content" }>;

/** A canonical sitemap page id whose materialized route page does not exist. */
export class SitemapPageNotFoundError extends Data.TaggedError(
  "SitemapPageNotFoundError"
)<{
  readonly pageId: string;
}> {}

/** Static top-level routes in canonical lexical order. */
export const baseRoutes: readonly string[] = [
  "/",
  "/contributor",
  "/curricula",
  "/privacy-policy",
  quranRootRoute,
  "/search",
  "/security-policy",
  "/terms-of-service",
];

/** Reads sitemap page descriptors without loading route rows. */
export const readSitemapPageDescriptors = Effect.fn(
  "www.sitemap.pageDescriptors"
)(function* () {
  const descriptors: SitemapPage[] = [{ id: sitemapBasePageId }];

  for (const locale of routing.locales) {
    const [counts, publicCount] = yield* Effect.all(
      [
        getRuntimeContentRouteCounts({ locale }),
        getRuntimePublicSitemapCount({ locale }),
      ],
      { concurrency: "unbounded" }
    );

    if (publicCount) {
      for (let page = 0; page < publicCount.pageCount; page++) {
        descriptors.push({
          id: formatPublicSitemapPageId({ locale, page }),
          kind: "public",
          locale,
          page,
        });
      }
    }

    for (const count of counts) {
      const section = count.section;
      const pageCount = Math.ceil(
        count.count / CONTENT_SITEMAP_ROUTE_PAGE_SIZE
      );

      for (let page = 0; page < pageCount; page++) {
        descriptors.push({
          id: formatContentSitemapPageId({ locale, section, page }),
          kind: "content",
          locale,
          page,
          section,
        });
      }
    }
  }

  return descriptors;
});

/** Resolves one sitemap page id into the route artifact page it represents. */
export function getSitemapPageDescriptor(id: string): SitemapPage | null {
  if (id === sitemapBasePageId) {
    return { id: sitemapBasePageId };
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
    if (page === null) {
      return null;
    }

    return {
      id,
      kind: "public",
      locale,
      page,
    };
  }

  if (prefix !== "content" || segments.length !== 4) {
    return null;
  }

  const section = segments[2];
  if (!isRuntimeContentSection(section)) {
    return null;
  }

  const page = parsePageNumber(segments[3]);
  if (page === null) {
    return null;
  }

  return {
    id,
    kind: "content",
    locale,
    page,
    section,
  };
}

/** Reads the bounded routes and shared metadata for one sitemap page. */
export const readSitemapRoutePage = Effect.fn("www.sitemap.routePage")(
  function* (pageId: string) {
    const page = getSitemapPageDescriptor(pageId);

    if (!page) {
      return yield* Effect.fail(new SitemapPageNotFoundError({ pageId }));
    }

    if (isPublicSitemapPage(page)) {
      const artifact = yield* getRuntimePublicSitemapPage({
        locale: page.locale,
        page: page.page,
      });

      if (!artifact) {
        return yield* Effect.fail(new SitemapPageNotFoundError({ pageId }));
      }

      return {
        routes: artifact.paths.map((path) => ({
          lastModified: artifact.syncedAt,
          path: routeToPath(path),
        })),
      };
    }

    if (!isContentSitemapPage(page)) {
      return {
        routes: baseRoutes.map((path) => ({ lastModified: undefined, path })),
      };
    }

    const artifact = yield* getRuntimeContentSitemapPage({
      locale: page.locale,
      page: page.page,
      section: page.section,
    });

    if (!artifact) {
      return yield* Effect.fail(new SitemapPageNotFoundError({ pageId }));
    }

    return { routes: yield* buildSitemapContentPageRoutes(artifact.routes) };
  }
);

/** Formats one materialized content route page id for Next.js sitemap generation. */
function formatContentSitemapPageId({
  locale,
  page,
  section,
}: {
  locale: Locale;
  page: number;
  section: RuntimeContentSection;
}) {
  return `content_${locale}_${section}_${page}`;
}

/** Formats one bounded public-context sitemap page id. */
function formatPublicSitemapPageId({
  locale,
  page,
}: {
  locale: Locale;
  page: number;
}) {
  return `public_${locale}_${page}`;
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

/** Checks whether a raw route page segment is a content section. */
function isRuntimeContentSection(
  section: string | undefined
): section is RuntimeContentSection {
  return contentSections.some((candidate) => candidate === section);
}

/** Checks whether one parsed sitemap page targets content route rows. */
function isContentSitemapPage(page: SitemapPage): page is ContentSitemapPage {
  return "kind" in page && page.kind === "content";
}

/** Checks whether one parsed sitemap page targets public route rows. */
function isPublicSitemapPage(
  page: SitemapPage
): page is Extract<SitemapPage, { kind: "public" }> {
  return "kind" in page && page.kind === "public";
}

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}
