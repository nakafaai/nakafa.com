import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { readPathWithoutNamespace } from "@repo/contents/_types/route/path";
import {
  readPublicPracticeDomainPath,
  readPublicPracticeQuestionNumber,
} from "@repo/contents/_types/route/practice/path";
import {
  readPublicPracticeQuestionRouteByPath,
  readPublicPracticeQuestionRouteBySourcePath,
} from "@repo/contents/_types/route/practice/question";
import type {
  PublicContentRoute,
  PublicPracticeQuestionRoute,
} from "@repo/contents/_types/route/schema";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import type { Locale } from "next-intl";

export type PracticeSetRoute = Extract<
  PublicContentRoute,
  { readonly kind: "exercise-set" }
> & { readonly description: string };
export type PracticeQuestionRoute = PublicPracticeQuestionRoute;
export type PracticeRoute = PracticeSetRoute | PracticeQuestionRoute;
export type PublicPracticeRouteRows = readonly PracticeSetRoute[];

let practiceRouteCache: PublicPracticeRouteRows | undefined;

/** Lazily decodes canonical practice set rows at the Next framework boundary. */
export function readPracticeRoutes(): PublicPracticeRouteRows {
  if (practiceRouteCache) {
    return practiceRouteCache;
  }

  practiceRouteCache = Effect.runSync(
    Effect.map(listPublicContentRoutes(), (routes) =>
      routes.filter(isPracticeSetRoute)
    )
  );

  return practiceRouteCache;
}

/**
 * Reads localized alternate rows for a concrete practice set or question.
 *
 * Set alternates are matched by source set identity; question alternates are
 * derived from the question source path so hreflang rows stay exact.
 */
export function readPracticeRouteAlternates(
  route: PracticeRoute,
  routes: PublicPracticeRouteRows
) {
  const alternates: PracticeRoute[] = [];

  for (const locale of locales) {
    const candidate =
      route.kind === "exercise-question"
        ? readPublicPracticeQuestionRouteBySourcePath({
            domains: MATERIAL_ROUTE_DOMAINS,
            locale,
            materials: MATERIAL_SOURCES,
            sourcePath: route.sourcePath,
          })
        : routes.find(
            (item) =>
              item.locale === locale && item.sourcePath === route.sourcePath
          );

    if (candidate && isPracticeRoute(candidate)) {
      alternates.push(candidate);
    }
  }

  return alternates;
}

/**
 * Converts a projected route row to a locale-prefixed app href.
 *
 * Practice pages use these public URLs for learner navigation while the attempt
 * store continues to use the source set slug.
 */
export function toPracticeHref(
  route: Pick<PracticeRoute, "locale" | "publicPath">
) {
  return `/${route.locale}/${route.publicPath}`;
}

/** Finds one projected practice set by localized path without namespace. */
export function findPracticeRoute(
  routes: PublicPracticeRouteRows,
  locale: Locale,
  pathWithoutNamespace: string
) {
  return routes.find(
    (candidate) =>
      candidate.locale === locale &&
      readPathWithoutNamespace(candidate.publicPath) === pathWithoutNamespace
  );
}

/** Finds concrete set rows for one rendered practice domain page. */
export function findPracticeDomainRoutes(
  routes: PublicPracticeRouteRows,
  locale: Locale,
  pathWithoutNamespace: string
) {
  return routes.filter(
    (candidate) =>
      candidate.locale === locale &&
      readPathWithoutNamespace(readPublicPracticeDomainPath(candidate)) ===
        pathWithoutNamespace
  );
}

/** Resolves a localized virtual question route from the projected set route. */
export function readPracticeQuestionRoute({
  locale,
  path,
  routes,
  setPathWithoutNamespace,
}: {
  locale: Locale;
  path: readonly string[];
  routes: PublicPracticeRouteRows;
  setPathWithoutNamespace: string;
}) {
  const questionSegment = path.at(-1);

  if (
    readPublicPracticeQuestionNumber({ locale, segment: questionSegment }) ===
    null
  ) {
    return;
  }

  const setRoute = findPracticeRoute(routes, locale, setPathWithoutNamespace);

  if (!setRoute) {
    return;
  }

  return readPublicPracticeQuestionRouteByPath({
    domains: MATERIAL_ROUTE_DOMAINS,
    locale,
    materials: MATERIAL_SOURCES,
    publicPath: `${setRoute.publicPath}/${questionSegment}`,
  });
}

/** Checks whether one content route is an authored exercise set row. */
export function isPracticeSetRoute(
  route: PublicContentRoute
): route is PracticeSetRoute {
  return (
    route.kind === "exercise-set" &&
    route.parentPath !== undefined &&
    route.description !== undefined
  );
}

/** Checks whether one content route is a practice set or question row. */
function isPracticeRoute(route: PublicContentRoute): route is PracticeRoute {
  return route.kind === "exercise-set" || route.kind === "exercise-question";
}
