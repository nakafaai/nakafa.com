import type { Locale } from "@repo/contents/_types/content";
import {
  createMaterialContextIndex,
  type MaterialContextIndex,
} from "@repo/contents/_types/route/learning/context";
import {
  readLocalePathKey,
  readRouteLocaleIdentityKey,
} from "@repo/contents/_types/route/learning/key";
import type {
  MaterialContextIdentity,
  MaterialRouteIdentity,
} from "@repo/contents/_types/route/material/reference";
import { normalizePublicPath } from "@repo/contents/_types/route/path";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";

const contentRouteKinds = new Set<PublicRoute["kind"]>([
  "subject-lesson",
  "subject-topic",
]);

function isPublicContentRoute(route: PublicRoute): route is PublicContentRoute {
  return contentRouteKinds.has(route.kind);
}

/**
 * Builds keyed route/context maps from already-decoded public route rows.
 *
 * Bulk projection still happens in source/sync jobs. Runtime callers keep a
 * bounded lookup Interface and do not retain route-array scanning knowledge.
 */
export function createPublicLearningIndex({
  routes,
}: {
  routes: readonly PublicRoute[];
}) {
  const routesByPath = new Map<string, PublicRoute>();
  const routesByIdentityAndLocale = new Map<string, PublicRoute>();
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

    if (isPublicContentRoute(route)) {
      contentRoutes.push(route);
    }
  }

  const materialContextIndex = createMaterialContextIndex({
    contentRoutes,
    curriculumRoutes,
  });

  /** Resolves one localized path using exact public route rows. */
  function resolveRouteByPath(path: string, locale: Locale) {
    const publicPath = normalizePublicPath(path);
    return routesByPath.get(readLocalePathKey(locale, publicPath));
  }

  /** Projects one route row to the target locale through source identity keys. */
  function projectRouteToLocale(route: PublicRoute, locale: Locale) {
    return routesByIdentityAndLocale.get(
      readRouteLocaleIdentityKey(route, locale)
    );
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
