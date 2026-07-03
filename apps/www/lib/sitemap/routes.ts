import type { api } from "@repo/backend/convex/_generated/api";
import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import { findPublicContentRouteBySourcePath } from "@repo/contents/_types/route/content";
import {
  readPublicPracticeAssessmentPath,
  readPublicPracticeDomainPath,
} from "@repo/contents/_types/route/practice/path";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { routing } from "@repo/internationalization/src/routing";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Option } from "effect";
import { hasLocale, type Locale } from "next-intl";
import {
  getRuntimeContentRouteArtifactPage,
  getRuntimeContentRouteCounts,
  getRuntimeSitemapPublicRoutes,
} from "@/lib/content/runtime/routes";

type RuntimeContentSection = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>["section"];
type RuntimeContentRoute = NonNullable<
  FunctionReturnType<
    typeof api.contents.queries.runtime.getContentRouteArtifactPage
  >
>["routes"][number];
type RuntimeSitemapPublicRoute = FunctionReturnType<
  typeof api.contents.queries.runtime.listSitemapPublicRoutes
>["page"][number];
type RuntimeSitemapPublicRoutePage = FunctionReturnType<
  typeof api.contents.queries.runtime.listSitemapPublicRoutes
>;
const contentSections: readonly RuntimeContentSection[] = [
  "articles",
  "material",
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
    };

/** Descriptor for one graph-backed sitemap artifact page. */
export type ContentSitemapPage = Extract<SitemapPage, { kind: "content" }>;

/** Static top-level routes that should always be present in the sitemap. */
export const baseRoutes = [
  "/",
  "/search",
  "/contributor",
  "/curricula",
  quranRootRoute,
  "/terms-of-service",
  "/privacy-policy",
  "/security-policy",
];

/** Lists stable sitemap page ids from materialized route counts. */
export function getSitemapPageDescriptors() {
  return Effect.runPromise(readSitemapPageDescriptors());
}

/** Reads sitemap page descriptors without loading route rows. */
export const readSitemapPageDescriptors = Effect.fn(
  "www.sitemap.pageDescriptors"
)(function* () {
  const descriptors: SitemapPage[] = [{ id: sitemapBasePageId }];

  for (const locale of routing.locales) {
    descriptors.push({
      id: formatPublicSitemapPageId(locale),
      kind: "public",
      locale,
    });

    const counts = yield* getRuntimeContentRouteCounts({ locale });

    for (const count of counts) {
      const section = count.section;
      const pageCount = Math.ceil(
        count.count / CONTENT_ROUTE_ARTIFACT_PAGE_SIZE
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
export function getSitemapPageDescriptor(id: string | undefined) {
  if (!id || id === sitemapBasePageId) {
    return { id: sitemapBasePageId } satisfies SitemapPage;
  }

  const [prefix, locale, section, rawPage] = id.split("_");

  if (prefix === "public" && hasLocale(routing.locales, locale) && !section) {
    return {
      id,
      kind: "public",
      locale,
    } satisfies SitemapPage;
  }

  if (prefix !== "content" || !hasLocale(routing.locales, locale)) {
    return null;
  }

  if (!isRuntimeContentSection(section)) {
    return null;
  }

  const page = Number.parseInt(rawPage ?? "", 10);
  if (!Number.isInteger(page) || page < 0) {
    return null;
  }

  return {
    id,
    kind: "content",
    locale,
    page,
    section,
  } satisfies SitemapPage;
}

/** Runs the sitemap route Effect at the Next metadata boundary. */
export function getSitemapRoutes(pageId?: string) {
  return Effect.runPromise(readSitemapRoutes(pageId));
}

/** Builds the deduplicated route list for one sitemap page. */
export const readSitemapRoutes = Effect.fn("www.sitemap.routes")(function* (
  pageId?: string
) {
  const page = getSitemapPageDescriptor(pageId);

  if (!page) {
    return [];
  }

  if (isPublicSitemapPage(page)) {
    return yield* readSitemapPublicRoutes(page.locale);
  }

  if (!isContentSitemapPage(page)) {
    return sortRoutes(baseRoutes);
  }

  const rows = yield* getRuntimeContentRoutePageRows(page);
  const routes = yield* buildSitemapContentPageRoutes(rows);
  return sortRoutes(routes);
});

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

/** Formats the public-context route sitemap page id for one locale. */
function formatPublicSitemapPageId(locale: Locale) {
  return `public_${locale}`;
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

/** Reads one materialized content route page through the Convex route catalog. */
function getRuntimeContentRoutePageRows(page: ContentSitemapPage) {
  return getRuntimeContentRouteArtifactPage({
    locale: page.locale,
    page: page.page,
    section: page.section,
  }).pipe(
    Effect.map((artifactPage) => {
      if (!artifactPage) {
        return [];
      }

      return artifactPage.routes;
    })
  );
}

/** Builds sitemap page routes from concrete route catalog rows. */
export const buildSitemapContentPageRoutes = Effect.fn(
  "www.sitemap.contentPageRoutes"
)(function* (rows: readonly RuntimeContentRoute[]) {
  const routes = new Set<string>();

  for (const row of rows) {
    yield* addContentPageRoutes(routes, row);
  }

  return sortRoutes(routes);
});

/** Reads sitemap-eligible public context routes through bounded Convex pages. */
const readSitemapPublicRoutes = Effect.fn("www.sitemap.publicRoutes")(
  function* (locale: Locale) {
    const routes = new Set<string>();
    let cursor: string | null = null;

    while (true) {
      const page: RuntimeSitemapPublicRoutePage =
        yield* getRuntimeSitemapPublicRoutes({
          cursor,
          limit: CONTENT_ROUTE_ARTIFACT_PAGE_SIZE,
          locale,
        });

      for (const route of page.page) {
        if (isSitemapPublicContextRoute(route)) {
          routes.add(routeToPath(route.publicPath));
        }
      }

      if (page.isDone) {
        return sortRoutes(routes);
      }

      cursor = page.continueCursor;
    }
  }
);

/** Adds the concrete route and supported parent index routes. */
function addContentPageRoutes(routes: Set<string>, row: RuntimeContentRoute) {
  return Effect.gen(function* () {
    if (row.section === "articles") {
      addArticleRoutes(routes, row.route);
      return;
    }

    if (row.section === "quran") {
      routes.add(routeToPath(row.route));
      return;
    }

    const route = yield* findPublicContentRouteBySourcePath(
      row.sourcePath,
      row.locale
    );

    if (Option.isNone(route)) {
      return;
    }

    addProjectedContentRoutes(routes, route.value);
  });
}

/** Adds article category and detail routes. */
function addArticleRoutes(routes: Set<string>, route: string) {
  const [, category] = route.split("/");
  routes.add(`/articles/${category}`);
  routes.add(routeToPath(route));
}

/** Adds projected public content routes plus their useful listing parents. */
function addProjectedContentRoutes(
  routes: Set<string>,
  route: PublicContentRoute
) {
  if (route.kind === "subject-topic") {
    return;
  }

  if (route.kind === "subject-lesson") {
    routes.add(routeToPath(route.publicPath));
    return;
  }

  if (route.kind === "exercise-question") {
    routes.add(routeToPath(route.parentPath));
  }

  routes.add(routeToPath(readPublicPracticeAssessmentPath(route)));
  routes.add(routeToPath(readPublicPracticeDomainPath(route)));
  routes.add(routeToPath(route.publicPath));
}

/** Keeps public-route sitemap rows scoped to rendered app context pages. */
function isSitemapPublicContextRoute(route: RuntimeSitemapPublicRoute) {
  return route.kind === "curriculum-context";
}

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}

/** Returns routes in stable lexical order for deterministic artifacts. */
function sortRoutes(routes: Iterable<string>) {
  return Array.from(new Set(routes)).sort((a, b) => a.localeCompare(b));
}
