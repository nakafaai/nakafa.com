import type { api } from "@repo/backend/convex/_generated/api";
import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/spec";
import { routing } from "@repo/internationalization/src/routing";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { hasLocale, type Locale } from "next-intl";
import {
  getRuntimeContentRouteArtifactPage,
  getRuntimeContentRouteCounts,
} from "@/lib/content/runtime";

type RuntimeContentSection = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>["section"];
type RuntimeContentRoute = NonNullable<
  FunctionReturnType<
    typeof api.contents.queries.runtime.getContentRouteArtifactPage
  >
>["routes"][number];
type SourceRouteProjection = NonNullable<
  ReturnType<typeof getSourceRouteProjectionForRoute>
>;
type ExerciseRouteProjection = NonNullable<SourceRouteProjection["exercise"]>;

const contentSections: readonly RuntimeContentSection[] = [
  "articles",
  "subject",
  "exercises",
  "quran",
];
const sitemapBasePageId = "base";
const quranRootRoute = "/quran";
const subjectRootRoute = "/subject";
const tryOutYearSegment = /^\d{4}$/;

export interface ContentSitemapPage {
  id: string;
  locale: Locale;
  page: number;
  section: RuntimeContentSection;
}

type SitemapPage = { id: typeof sitemapBasePageId } | ContentSitemapPage;

/** Static top-level routes that should always be present in the sitemap. */
export const baseRoutes = [
  "/",
  "/search",
  "/contributor",
  quranRootRoute,
  subjectRootRoute,
  "/terms-of-service",
  "/privacy-policy",
  "/security-policy",
];

/** Lists stable sitemap page ids from materialized route counts. */
export function getSitemapPageDescriptors() {
  return Effect.runPromise(getSitemapPageDescriptorsEffect());
}

/** Reads sitemap page descriptors without loading route rows. */
export const getSitemapPageDescriptorsEffect = Effect.fn(
  "www.sitemap.pageDescriptors"
)(function* () {
  const descriptors: SitemapPage[] = [{ id: sitemapBasePageId }];

  for (const locale of routing.locales) {
    const counts = yield* getRuntimeContentRouteCounts({ locale });

    for (const count of counts) {
      const section = count.section;
      const pageCount = Math.ceil(
        count.count / CONTENT_ROUTE_ARTIFACT_PAGE_SIZE
      );

      for (let page = 0; page < pageCount; page++) {
        descriptors.push({
          id: formatContentSitemapPageId({ locale, section, page }),
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
    locale,
    page,
    section,
  } satisfies SitemapPage;
}

/** Builds the deduplicated route list for one sitemap page. */
export async function getSitemapRoutes(pageId?: string) {
  const page = getSitemapPageDescriptor(pageId);

  if (!page) {
    return [];
  }

  if (!isContentSitemapPage(page)) {
    return sortRoutes(baseRoutes);
  }

  const rows = await getRuntimeContentRoutePageRows(page);
  return sortRoutes(buildSitemapContentPageRoutes(rows));
}

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

/** Checks whether a raw route page segment is a content section. */
function isRuntimeContentSection(
  section: string | undefined
): section is RuntimeContentSection {
  return contentSections.some((candidate) => candidate === section);
}

/** Checks whether one parsed sitemap page targets content route rows. */
function isContentSitemapPage(page: SitemapPage): page is ContentSitemapPage {
  return "section" in page && typeof page.section === "string";
}

/** Reads one materialized content route page through the Convex route catalog. */
function getRuntimeContentRoutePageRows(page: ContentSitemapPage) {
  return Effect.runPromise(
    getRuntimeContentRouteArtifactPage({
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
    )
  );
}

/** Builds sitemap page routes from concrete route catalog rows. */
export function buildSitemapContentPageRoutes(
  rows: readonly RuntimeContentRoute[]
) {
  const routes = new Set<string>();

  for (const row of rows) {
    addContentPageRoutes(routes, row.route);
  }

  return sortRoutes(routes);
}

/** Adds the concrete route and supported parent index routes. */
function addContentPageRoutes(routes: Set<string>, route: string) {
  const projection = getSourceRouteProjectionForRoute(route);

  if (!projection) {
    return;
  }

  if (projection.kind === "article") {
    addArticleRoutes(routes, projection);
    return;
  }

  if (projection.kind === "subject-section") {
    addSubjectRoutes(routes, projection);
    return;
  }

  const { exercise } = projection;
  if (exercise) {
    addExerciseRoutes(routes, exercise);
    return;
  }

  routes.add(routeToPath(projection.route));
}

/** Adds article category and detail routes. */
function addArticleRoutes(
  routes: Set<string>,
  projection: SourceRouteProjection
) {
  const [, category] = projection.lensSegments;

  routes.add(`/articles/${category}`);
  routes.add(routeToPath(projection.route));
}

/** Adds subject grade, material, and lesson routes. */
function addSubjectRoutes(
  routes: Set<string>,
  projection: SourceRouteProjection
) {
  const [, category, grade, material] = projection.lensSegments;

  routes.add(`/subject/${category}/${grade}`);
  routes.add(`/subject/${category}/${grade}/${material}`);
  routes.add(routeToPath(projection.route));
}

/** Adds exercise listing, group, set, and question routes. */
function addExerciseRoutes(
  routes: Set<string>,
  exercise: ExerciseRouteProjection
) {
  const {
    categorySegment: category,
    groupSegments,
    materialSegment: material,
    questionSegment,
    setSegment,
    typeSegment: type,
  } = exercise;
  routes.add(`/exercises/${category}/${type}`);
  routes.add(`/exercises/${category}/${type}/${material}`);

  const nestedSegments = [...groupSegments];

  if (setSegment) {
    nestedSegments.push(setSegment);
  }
  if (questionSegment) {
    nestedSegments.push(questionSegment);
  }

  for (const nestedRoute of getExerciseNestedRoutes(nestedSegments)) {
    routes.add(`/exercises/${category}/${type}/${material}/${nestedRoute}`);
  }
}

/** Builds canonical exercise nested routes from concrete set/question routes. */
function getExerciseNestedRoutes(rest: string[]) {
  const routes: string[] = [];
  const nested: string[] = [];

  for (const segment of rest) {
    nested.push(segment);

    if (isInvalidExerciseNestedRoute(nested)) {
      continue;
    }

    routes.push(nested.join("/"));
  }

  return routes;
}

/** Checks whether an exercise route is missing the required try-out year. */
function isInvalidExerciseNestedRoute(parts: string[]) {
  if (parts[0] !== "try-out") {
    return false;
  }

  return !(parts[1] && tryOutYearSegment.test(parts[1]));
}

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}

/** Returns routes in stable lexical order for deterministic artifacts. */
function sortRoutes(routes: Iterable<string>) {
  return Array.from(new Set(routes)).sort((a, b) => a.localeCompare(b));
}
