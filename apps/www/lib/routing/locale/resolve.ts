import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import {
  MATERIAL_CONTEXT_QUERY_PARAM,
  projectMaterialContextHintToLocale,
} from "@repo/contents/_types/route/material/context";
import { listMaterialContextRefs } from "@repo/contents/_types/route/material/reference";
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
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Data, Effect, Option } from "effect";
import { hasLocale } from "next-intl";
import { isSamePublicRouteIdentity } from "@/lib/routing/locale/identity";

/** Locale values accepted by next-intl routing and public route projection. */
type Locale = (typeof routing.locales)[number];

/**
 * Concrete practice set rows are the source for virtual practice root/domain
 * pages, because roots and domains are renderable app pages without their own
 * persisted public-route row.
 */
type PublicPracticeSetRoute = Extract<PublicRoute, { kind: "exercise-set" }>;

/** Browser route-localization request accepted by the resolver. */
interface LocalizedHrefInput {
  href: string;
  locale: Locale;
}

/** Normalized browser href after stripping one optional leading locale segment. */
interface ParsedLocalizedHref {
  currentLocale: Locale | undefined;
  hash: string;
  publicPath: string;
  search: string;
}

/** Raised when the browser href cannot be parsed as a safe URL. */
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

/** Narrows the leading path segment to a configured locale, if present. */
function readLocale(value: string | undefined) {
  if (value && hasLocale(routing.locales, value)) {
    return value;
  }

  return;
}

/**
 * Parses absolute or relative browser hrefs against Nakafa's origin while
 * preserving query/hash state for the final localized navigation.
 */
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

/**
 * Returns a next-intl navigation href without a locale prefix; the router adds
 * the target locale using its configured localized pathname mapping.
 */
function toNavigationHref(publicPath: string, suffix = "") {
  return `/${publicPath}${suffix}`;
}

/** Preserves static page query/hash state when no source projection is needed. */
function toStaticNavigationHref(parsed: ParsedLocalizedHref) {
  return toNavigationHref(parsed.publicPath, `${parsed.search}${parsed.hash}`);
}

/**
 * Detects paths in a projected namespace so missing rows fail closed instead of
 * falling back to mixed-locale static navigation.
 */
function isProjectedNamespace(publicPath: string, locale: Locale) {
  const namespace = publicPath.split("/").filter(Boolean)[0];

  return PUBLIC_ROUTE_SURFACES.some(
    (surface) => surface.routeSlugs[locale] === namespace
  );
}

/** Narrows public route rows to concrete practice sets. */
function isPracticeSetRoute(
  route: PublicRoute
): route is PublicPracticeSetRoute {
  return route.kind === "exercise-set";
}

/**
 * Finds the target-locale public path for one projected route using stable
 * source identity rather than localized slug text.
 */
function readTargetProjectedRoute({
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
    });
  }

  return routes.find(
    (candidate) =>
      candidate.locale === locale && isSamePublicRouteIdentity(route, candidate)
  );
}

/**
 * Resolves virtual practice program roots such as `/latihan/snbt` from the
 * concrete set row that owns the assessment/source identity.
 */
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

/**
 * Resolves virtual practice domain pages from concrete set rows with the same
 * source material key in the target locale.
 */
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

/** Narrows projected route rows to canonical content/practice rows. */
function isContentRoute(route: PublicRoute): route is PublicContentRoute {
  return route.kind !== "curriculum-context";
}

/** Narrows projected route rows to curriculum context rows. */
function isCurriculumRoute(route: PublicRoute): route is PublicCurriculumRoute {
  return route.kind === "curriculum-context";
}

/**
 * Preserves only validated material context state across localized projections.
 *
 * Other projected routes intentionally drop query/hash state because localized
 * source-owned slugs and heading anchors are not guaranteed to be equivalent.
 */
function readProjectedRouteSuffix({
  parsed,
  route,
  routes,
  targetRoute,
}: {
  parsed: ParsedLocalizedHref;
  route: PublicRoute;
  routes: readonly PublicRoute[];
  targetRoute: PublicRoute;
}) {
  if (
    !(
      isContentRoute(route) &&
      isContentRoute(targetRoute) &&
      isMaterialLessonRoute(route) &&
      isMaterialLessonRoute(targetRoute)
    )
  ) {
    return "";
  }

  const context = new URLSearchParams(parsed.search).get(
    MATERIAL_CONTEXT_QUERY_PARAM
  );
  const projectedContext = projectMaterialContextHintToLocale({
    context,
    currentRoute: route,
    refs: listMaterialContextRefs({
      contentRoutes: routes.filter(isContentRoute),
      curriculumRoutes: routes.filter(isCurriculumRoute),
    }),
    targetRoute,
  });

  if (!projectedContext) {
    return "";
  }

  const search = new URLSearchParams();
  search.set(MATERIAL_CONTEXT_QUERY_PARAM, projectedContext);

  return `?${search.toString()}`;
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
    const targetRoute = yield* Effect.fromNullable(
      readTargetProjectedRoute({
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

    return toNavigationHref(
      targetRoute.publicPath,
      readProjectedRouteSuffix({
        parsed,
        route: projectedRoute,
        routes,
        targetRoute,
      })
    );
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
