import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { readPracticeSourceSetParts } from "@repo/contents/_types/route/practice/identity";
import {
  readPublicPracticeAssessmentPath,
  readPublicPracticeDomainPath,
} from "@repo/contents/_types/route/practice/path";
import { readPublicPracticeQuestionRouteBySourcePath } from "@repo/contents/_types/route/practice/question";
import {
  findPublicRouteByPath,
  listPublicRoutes,
} from "@repo/contents/_types/route/projection";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Data, Effect, Option } from "effect";
import { hasLocale } from "next-intl";
import { isSamePublicRouteIdentity } from "@/lib/routing/locale/identity";

type Locale = (typeof routing.locales)[number];
type PublicPracticeSetRoute = Extract<PublicRoute, { kind: "exercise-set" }>;

interface LocalizedHrefInput {
  href: string;
  locale: Locale;
}

interface ParsedLocalizedHref {
  currentLocale: Locale | undefined;
  hash: string;
  publicPath: string;
  search: string;
}

class InvalidLocalizedHrefError extends Data.TaggedError(
  "InvalidLocalizedHrefError"
)<{
  cause: unknown;
  href: string;
}> {}

/** Raised when a localized route exists but has no target-locale projection. */
export class MissingLocalizedRouteProjectionError extends Data.TaggedError(
  "MissingLocalizedRouteProjectionError"
)<{
  locale: Locale;
  publicPath: string;
}> {}

const URL_BASE = "https://nakafa.com";

function readLocale(value: string | undefined) {
  if (value && hasLocale(routing.locales, value)) {
    return value;
  }

  return;
}

function parseLocalizedHref(href: string): ParsedLocalizedHref {
  const url = new URL(href, URL_BASE);
  const segments = url.pathname.split("/").filter(Boolean);
  const currentLocale = readLocale(segments[0]);
  const publicSegments = currentLocale ? segments.slice(1) : segments;

  return {
    currentLocale,
    hash: url.hash,
    publicPath: publicSegments.join("/"),
    search: url.search,
  };
}

function toNavigationHref(publicPath: string, suffix = "") {
  return `/${publicPath}${suffix}`;
}

function toStaticNavigationHref(parsed: ParsedLocalizedHref) {
  return toNavigationHref(parsed.publicPath, `${parsed.search}${parsed.hash}`);
}

function isProjectedNamespace(publicPath: string, locale: Locale) {
  const namespace = publicPath.split("/").filter(Boolean)[0];

  return PUBLIC_ROUTE_SURFACES.some(
    (surface) => surface.routeSlugs[locale] === namespace
  );
}

function isPracticeSetRoute(
  route: PublicRoute
): route is PublicPracticeSetRoute {
  return route.kind === "exercise-set";
}

function readTargetProjectedPath({
  locale,
  route,
  routes,
}: {
  locale: Locale;
  route: PublicRoute;
  routes: readonly PublicRoute[];
}) {
  if (route.kind === "exercise-question") {
    return readPublicPracticeQuestionRouteBySourcePath({
      domains: MATERIAL_ROUTE_DOMAINS,
      locale,
      materials: MATERIAL_SOURCES,
      sourcePath: route.sourcePath,
    })?.publicPath;
  }

  const targetRoute = routes.find(
    (candidate) =>
      candidate.locale === locale && isSamePublicRouteIdentity(route, candidate)
  );

  return targetRoute?.publicPath;
}

function readPracticeRootTargetPath({
  locale,
  path,
  routes,
}: {
  locale: Locale;
  path: string;
  routes: readonly PublicRoute[];
}) {
  const currentRoute = routes.find(
    (route): route is PublicPracticeSetRoute =>
      isPracticeSetRoute(route) &&
      readPublicPracticeAssessmentPath(route) === path
  );

  if (!currentRoute) {
    return;
  }

  const currentSource = readPracticeSourceSetParts(currentRoute.sourcePath);

  const targetRoute = routes.find((route): route is PublicPracticeSetRoute => {
    if (!(isPracticeSetRoute(route) && route.locale === locale)) {
      return false;
    }

    return (
      readPracticeSourceSetParts(route.sourcePath)?.type === currentSource?.type
    );
  });

  return Option.getOrUndefined(
    Option.map(
      Option.fromNullable(targetRoute),
      readPublicPracticeAssessmentPath
    )
  );
}

function readPracticeDomainTargetPath({
  locale,
  path,
  routes,
}: {
  locale: Locale;
  path: string;
  routes: readonly PublicRoute[];
}) {
  const currentRoute = routes.find(
    (route): route is PublicPracticeSetRoute =>
      isPracticeSetRoute(route) && readPublicPracticeDomainPath(route) === path
  );

  if (!currentRoute) {
    return;
  }

  const targetRoute = routes.find(
    (route): route is PublicPracticeSetRoute =>
      isPracticeSetRoute(route) &&
      route.locale === locale &&
      route.materialKey === currentRoute.materialKey
  );

  return Option.getOrUndefined(
    Option.map(Option.fromNullable(targetRoute), readPublicPracticeDomainPath)
  );
}

/**
 * Resolves a browser href to the target locale's route-owned navigation href.
 *
 * Projected content routes are matched by stable source identity. Static app
 * routes keep the regular next-intl locale switch behavior and preserve
 * query/hash state.
 */
export const resolveLocalizedNavigationHref = Effect.fn(
  "www.routing.locale.resolve"
)(function* (input: LocalizedHrefInput) {
  const parsed = yield* Effect.try({
    catch: (cause) =>
      new InvalidLocalizedHrefError({ cause, href: input.href }),
    try: () => parseLocalizedHref(input.href),
  });

  if (!parsed.currentLocale || parsed.currentLocale === input.locale) {
    return toStaticNavigationHref(parsed);
  }

  if (parsed.publicPath === "") {
    return toStaticNavigationHref(parsed);
  }

  const routes = yield* listPublicRoutes();
  const projectedRoute = yield* findPublicRouteByPath(
    parsed.publicPath,
    parsed.currentLocale
  ).pipe(Effect.map(Option.getOrUndefined));

  if (projectedRoute) {
    const targetPath = yield* Effect.fromNullable(
      readTargetProjectedPath({
        locale: input.locale,
        route: projectedRoute,
        routes,
      })
    ).pipe(
      Effect.mapError(
        () =>
          new MissingLocalizedRouteProjectionError({
            locale: input.locale,
            publicPath: parsed.publicPath,
          })
      )
    );

    return toNavigationHref(targetPath);
  }

  const practiceRootPath = readPracticeRootTargetPath({
    locale: input.locale,
    path: parsed.publicPath,
    routes,
  });

  if (practiceRootPath) {
    return toNavigationHref(practiceRootPath);
  }

  const practiceDomainPath = readPracticeDomainTargetPath({
    locale: input.locale,
    path: parsed.publicPath,
    routes,
  });

  if (practiceDomainPath) {
    return toNavigationHref(practiceDomainPath);
  }

  if (isProjectedNamespace(parsed.publicPath, parsed.currentLocale)) {
    return yield* new MissingLocalizedRouteProjectionError({
      locale: input.locale,
      publicPath: parsed.publicPath,
    });
  }

  return toStaticNavigationHref(parsed);
});
