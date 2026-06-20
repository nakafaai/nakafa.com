import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  isMaterialLessonRoute,
  isPracticeSetRoute,
  listPublicContentRoutes,
} from "@repo/contents/_types/route/content";
import {
  isRenderableCurriculumRoute,
  listPublicCurriculumRoutes,
} from "@repo/contents/_types/route/curriculum";
import {
  readPublicPracticeAssessmentPath,
  readPublicPracticeDomainPath,
  readPublicPracticeQuestionNumber,
} from "@repo/contents/_types/route/practice/path";
import { readPublicPracticeQuestionRouteByPath } from "@repo/contents/_types/route/practice/question";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { getRuntimeExerciseQuestionPage } from "@/lib/content/runtime/pages";

const PROJECTED_ROUTE_SURFACE_KEYS = new Set([
  "curriculum",
  "exercises",
  "subject",
]);

/**
 * Reads source-projected HTML routes that should not stream soft 404s.
 *
 * Cache Components remove `dynamicParams`, so the framework adapter calls this
 * after markdown negotiation to reject non-rendered grouping rows with HTTP 404
 * while preserving virtual practice question pages.
 */
export const readProjectedHtmlRouteRejection = Effect.fn(
  "www.routing.publicHtml.projectedRejection"
)(function* (pathname: string) {
  const [locale, namespace, ...pathSegments] = pathname
    .split("/")
    .filter(Boolean);

  if (!(namespace && hasLocale(routing.locales, locale))) {
    return null;
  }

  const surface = PUBLIC_ROUTE_SURFACES.find(
    (item) =>
      isProjectedRouteSurface(item.key) && item.routeSlugs[locale] === namespace
  );

  if (!surface) {
    return null;
  }

  const publicPath = [namespace, ...pathSegments].join("/");

  if (
    surface.key === "exercises" &&
    (yield* isRenderablePracticeQuestionPath({ locale, publicPath }))
  ) {
    return null;
  }

  const renderableProjectedHtmlPaths =
    yield* readRenderableProjectedHtmlPathSet();

  return renderableProjectedHtmlPaths.has(`${locale}:${publicPath}`)
    ? null
    : locale;
});

/**
 * Materializes the route projection rows that can render HTML without streaming
 * a soft-not-found response. The proxy reads this immutable set at request time
 * instead of importing curriculum, assessment, and material source registries.
 */
function readRenderableProjectedHtmlPathSet() {
  return Effect.gen(function* () {
    const [contentRoutes, curriculumRoutes] = yield* Effect.all([
      listPublicContentRoutes(),
      listPublicCurriculumRoutes(),
    ]);
    const routeKeys = new Set<string>();

    for (const route of contentRoutes) {
      if (route.kind === "subject-lesson" && isMaterialLessonRoute(route)) {
        routeKeys.add(`${route.locale}:${route.publicPath}`);
        continue;
      }

      if (isPracticeSetRoute(route)) {
        routeKeys.add(
          `${route.locale}:${readPublicPracticeAssessmentPath(route)}`
        );
        routeKeys.add(`${route.locale}:${route.publicPath}`);
        routeKeys.add(`${route.locale}:${readPublicPracticeDomainPath(route)}`);
      }
    }

    for (const route of curriculumRoutes) {
      if (isRenderableCurriculumRoute(route)) {
        routeKeys.add(`${route.locale}:${route.publicPath}`);
      }
    }

    return routeKeys;
  });
}

/**
 * Checks virtual practice question routes that are not part of static params.
 *
 * Practice question pages are derived from their canonical set source row, so
 * direct URLs need a source-owned lookup instead of a static route row.
 */
function isRenderablePracticeQuestionPath({
  locale,
  publicPath,
}: {
  locale: (typeof routing.locales)[number];
  publicPath: string;
}) {
  if (!hasPracticeQuestionShape({ locale, publicPath })) {
    return Effect.succeed(false);
  }

  const route = readPublicPracticeQuestionRouteByPath({
    domains: MATERIAL_ROUTE_DOMAINS,
    locale,
    materials: MATERIAL_SOURCES,
    publicPath,
  });

  if (!route) {
    return Effect.succeed(false);
  }

  return getRuntimeExerciseQuestionPage({
    locale,
    slug: route.sourcePath,
  }).pipe(
    Effect.match({
      onFailure: () => false,
      onSuccess: (questionPage) => questionPage !== null,
    })
  );
}

/** Checks only the localized virtual question suffix before the runtime probe. */
function hasPracticeQuestionShape({
  locale,
  publicPath,
}: {
  locale: (typeof routing.locales)[number];
  publicPath: string;
}) {
  const questionSegment = publicPath.split("/").at(-1);

  return (
    readPublicPracticeQuestionNumber({
      locale,
      segment: questionSegment,
    }) !== null
  );
}

/** Narrows public surfaces to projected app routes managed by this Module. */
function isProjectedRouteSurface(key: string) {
  return PROJECTED_ROUTE_SURFACE_KEYS.has(key);
}
