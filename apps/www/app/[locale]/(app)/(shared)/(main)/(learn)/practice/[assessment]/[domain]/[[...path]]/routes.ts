import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { readPathWithoutNamespace } from "@repo/contents/_types/route/path";
import {
  readPublicPracticeQuestionRouteByPath,
  readPublicPracticeQuestionRouteBySourcePath,
} from "@repo/contents/_types/route/practice";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { isLocalizedQuestionSegment } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/source";

export type PracticeSetRoute = Extract<
  PublicContentRoute,
  { readonly kind: "exercise-set" }
> & { readonly description: string };
export type PracticeQuestionRoute = Extract<
  PublicContentRoute,
  { readonly kind: "exercise-question" }
>;
export type PracticeRoute = PracticeSetRoute | PracticeQuestionRoute;
export type PublicPracticeRouteRows = readonly PracticeSetRoute[];

/**
 * Canonical practice set route rows from the public content projection.
 *
 * Next statically prerenders practice pages, so Server Components must read
 * plain route data instead of starting an Effect runtime during prerender.
 * Virtual question routes are derived from the same set rows and material
 * registries.
 */
export const PRACTICE_ROUTES: PublicPracticeRouteRows = Effect.runSync(
  Effect.map(listPublicContentRoutes(), (routes) =>
    routes.filter(isPracticeSetRoute)
  )
);

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

/** Finds the first set row that makes a public practice group page renderable. */
export function findPracticeGroupSet(
  routes: PublicPracticeRouteRows,
  locale: Locale,
  pathWithoutNamespace: string
) {
  return routes.find(
    (candidate) =>
      candidate.locale === locale &&
      readPathWithoutNamespace(candidate.parentPath) === pathWithoutNamespace
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

  if (!isLocalizedQuestionSegment(locale, questionSegment)) {
    return;
  }

  const setRoute = findPracticeRoute(routes, locale, setPathWithoutNamespace);

  if (!setRoute) {
    return;
  }

  const route = readPublicPracticeQuestionRouteByPath({
    domains: MATERIAL_ROUTE_DOMAINS,
    locale,
    materials: MATERIAL_SOURCES,
    publicPath: `${setRoute.publicPath}/${questionSegment}`,
  });

  return route && isPracticeQuestionRoute(route) ? route : undefined;
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

/** Checks whether one content row is a projected exercise question row. */
function isPracticeQuestionRoute(
  route: PublicContentRoute
): route is PracticeQuestionRoute {
  return route.kind === "exercise-question";
}
