import type { Locale } from "@repo/contents/_types/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  createMaterialContextIndex,
  type MaterialContextIndex,
} from "@repo/contents/_types/route/learning/context";
import {
  readLocalePathKey,
  readRouteLocaleIdentityKey,
} from "@repo/contents/_types/route/learning/key";
import {
  createPracticePathIndex,
  type PracticePathIndex,
} from "@repo/contents/_types/route/learning/practice";
import type {
  MaterialContextIdentity,
  MaterialRouteIdentity,
} from "@repo/contents/_types/route/material/reference";
import { normalizePublicPath } from "@repo/contents/_types/route/path";
import {
  readPublicPracticeQuestionRouteByPath,
  readPublicPracticeQuestionRouteBySourcePath,
} from "@repo/contents/_types/route/practice/question";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";

/**
 * Builds keyed route/context maps from already-decoded public route rows.
 *
 * Bulk projection still happens in source/sync jobs. Runtime callers keep a
 * bounded lookup Interface and do not retain route-array scanning knowledge.
 */
export function createPublicLearningIndex({
  domains,
  materials,
  routes,
}: {
  domains?: NonNullable<RouteInputs["domains"]>;
  materials?: NonNullable<RouteInputs["materials"]>;
  routes: readonly PublicRoute[];
}) {
  const routesByPath = new Map<string, PublicRoute>();
  const routesByIdentityAndLocale = new Map<string, PublicRoute>();
  const routeDomains = domains ?? MATERIAL_ROUTE_DOMAINS;
  const routeMaterials = materials ?? MATERIAL_SOURCES;
  const contentRoutes: PublicContentRoute[] = [];
  const curriculumRoutes: PublicCurriculumRoute[] = [];

  for (const route of routes) {
    routesByPath.set(readLocalePathKey(route.locale, route.publicPath), route);
    routesByIdentityAndLocale.set(
      readRouteLocaleIdentityKey(route, route.locale),
      route
    );

    if (route.kind === "curriculum-context") {
      curriculumRoutes.push(route);
      continue;
    }

    contentRoutes.push(route);
  }

  const practicePathIndex = createPracticePathIndex(routes);
  const materialContextIndex = createMaterialContextIndex({
    contentRoutes,
    curriculumRoutes,
  });

  /** Resolves one localized path using exact rows and virtual practice questions. */
  function resolveRouteByPath(path: string, locale: Locale) {
    const publicPath = normalizePublicPath(path);
    const route = routesByPath.get(readLocalePathKey(locale, publicPath));

    if (route) {
      return route;
    }

    return readPublicPracticeQuestionRouteByPath({
      domains: routeDomains,
      locale,
      materials: routeMaterials,
      publicPath,
    });
  }

  /** Projects one route row to the target locale through source identity keys. */
  function projectRouteToLocale(route: PublicRoute, locale: Locale) {
    if (route.kind === "exercise-question") {
      return readPublicPracticeQuestionRouteBySourcePath({
        domains: routeDomains,
        locale,
        materials: routeMaterials,
        sourcePath: route.sourcePath,
      });
    }

    return routesByIdentityAndLocale.get(
      readRouteLocaleIdentityKey(route, locale)
    );
  }

  /** Projects a virtual practice program root path through set-source identity. */
  function projectPracticeRootPath(
    input: Parameters<PracticePathIndex["projectRootPath"]>[0]
  ) {
    return practicePathIndex.projectRootPath(input);
  }

  /** Projects a virtual practice domain path through material/source identity. */
  function projectPracticeDomainPath(
    input: Parameters<PracticePathIndex["projectDomainPath"]>[0]
  ) {
    return practicePathIndex.projectDomainPath(input);
  }

  /** Preserves material context only when current and target source refs match. */
  function projectMaterialContextToLocale(
    input: Parameters<MaterialContextIndex["projectToLocale"]>[0]
  ) {
    return materialContextIndex.projectToLocale(input);
  }

  /** Resolves the material page return link from a validated source context. */
  function resolveMaterialHeaderLink(
    input: Parameters<MaterialContextIndex["resolveHeaderLink"]>[0]
  ) {
    return materialContextIndex.resolveHeaderLink(input);
  }

  /** Adds a material context query only when the target route validates it. */
  function toContextualMaterialHref(input: {
    context: MaterialContextIdentity;
    href: string;
    route: MaterialRouteIdentity;
  }) {
    return materialContextIndex.toContextualHref({
      contextRoute: input.context,
      href: input.href,
      route: input.route,
    });
  }

  return {
    projectMaterialContextToLocale,
    projectPracticeDomainPath,
    projectPracticeRootPath,
    projectRouteToLocale,
    resolveMaterialHeaderLink,
    resolveRouteByPath,
    toContextualMaterialHref,
  };
}

/**
 * Route-owned lookup Interface derived from `createPublicLearningIndex`.
 *
 * Callers ask source-identity questions instead of scanning all projected
 * routes, reconstructing practice roots, or parsing material context state.
 */
export type PublicLearningIndex = ReturnType<typeof createPublicLearningIndex>;
