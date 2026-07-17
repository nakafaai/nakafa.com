import type { ContentPagination, Locale } from "@repo/contents/_types/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import type { LessonMaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  comparePublicRouteOrder,
  decodeContentRoute,
  decodePublicPath,
  lookupDomainSlug,
  lookupNamespaceSegment,
  makePath,
  normalizePublicPath,
  uniqueRoutes,
} from "@repo/contents/_types/route/path";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { locales } from "@repo/utilities/locales";
import { Effect, Option } from "effect";

type MaterialContentRoute = Extract<
  PublicContentRoute,
  { readonly kind: "subject-topic" | "subject-lesson" }
>;
type MaterialLessonRoute = Extract<
  PublicContentRoute,
  { readonly kind: "subject-lesson" }
>;
type MaterialTopicRoute = Extract<
  PublicContentRoute,
  { readonly kind: "subject-topic" }
>;

/** Projects reusable material sources into canonical public routes. */
export const listPublicContentRoutes = Effect.fn("contents.route.listContent")(
  function* ({
    domains = MATERIAL_ROUTE_DOMAINS,
    materials = MATERIAL_SOURCES,
  }: Pick<RouteInputs, "domains" | "materials"> = {}) {
    const routes: PublicContentRoute[] = [];

    for (const material of materials) {
      routes.push(...(yield* listLessonPublicRoutes(material, domains)));
    }

    return yield* uniqueRoutes(routes);
  }
);

/** Finds a canonical public material route by source asset path. */
export const findPublicContentRouteBySourcePath = Effect.fn(
  "contents.route.findContentBySourcePath"
)(function* (sourcePath: string, locale: Locale, inputs: RouteInputs = {}) {
  const normalizedSourcePath = yield* decodePublicPath(
    normalizePublicPath(sourcePath)
  );
  const routes = yield* listPublicContentRoutes(inputs);
  const exactRoute = routes.find(
    (route) =>
      route.locale === locale && route.sourcePath === normalizedSourcePath
  );

  if (exactRoute) {
    return Option.some(exactRoute);
  }

  return Option.none();
});

/** Indexes material topic routes by locale and material key for context routes. */
export function createTopicRouteByMaterialKey({
  domains,
  materials,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  materials: NonNullable<RouteInputs["materials"]>;
}) {
  return Effect.gen(function* () {
    const routes = yield* listPublicContentRoutes({ domains, materials });
    const topicRouteByMaterialKey = new Map<string, PublicContentRoute>();

    for (const route of routes) {
      if (route.kind !== "subject-topic") {
        continue;
      }

      topicRouteByMaterialKey.set(
        `${route.locale}:${route.materialKey}`,
        route
      );
    }

    return topicRouteByMaterialKey;
  });
}

/** Checks whether one content row belongs to reusable lesson material. */
export function isMaterialContentRoute(
  route: PublicContentRoute
): route is MaterialContentRoute {
  return route.kind === "subject-topic" || route.kind === "subject-lesson";
}

/** Checks whether one content row is a concrete canonical lesson body. */
export function isMaterialLessonRoute(
  route: PublicContentRoute
): route is MaterialLessonRoute {
  return route.kind === "subject-lesson";
}

/** Checks whether one content row is an internal material topic grouping row. */
function isMaterialTopicRoute(
  route: PublicContentRoute
): route is MaterialTopicRoute {
  return route.kind === "subject-topic";
}

/** Converts one projected content route to its localized public href. */
export function toLocalizedContentHref(
  route: Pick<PublicContentRoute, "locale" | "publicPath">
) {
  return `/${route.locale}/${route.publicPath}`;
}

/** Finds the topic row that owns one canonical lesson body row. */
export function readParentMaterialRoute(
  route: PublicContentRoute,
  routes: readonly PublicContentRoute[]
) {
  if (!isMaterialLessonRoute(route)) {
    return;
  }

  return routes.find(
    (candidate) =>
      candidate.locale === route.locale &&
      isMaterialTopicRoute(candidate) &&
      candidate.publicPath === route.parentPath
  );
}

/**
 * Builds previous and next links between sibling lesson routes.
 *
 * `PaginationContent` uses empty items to render disabled endpoints. This
 * keeps that established UI contract while the route order comes from source
 * projection rows rather than app-local sorting.
 */
export function readMaterialPagination(
  route: PublicContentRoute,
  routes: readonly PublicContentRoute[],
  options: {
    readonly toHref?: (route: PublicContentRoute) => string;
  } = {}
): ContentPagination {
  const emptyItem = { href: "", title: "" };

  if (!(isMaterialLessonRoute(route) && route.parentPath)) {
    return { prev: emptyItem, next: emptyItem };
  }

  const siblings = routes
    .filter(
      (candidate) =>
        isMaterialLessonRoute(candidate) &&
        candidate.locale === route.locale &&
        candidate.parentPath === route.parentPath
    )
    .slice()
    .sort(comparePublicRouteOrder);
  const currentIndex = siblings.findIndex(
    (candidate) => candidate.publicPath === route.publicPath
  );

  if (currentIndex === -1) {
    return { prev: emptyItem, next: emptyItem };
  }

  return {
    prev: readPaginationItem(
      currentIndex > 0 ? siblings[currentIndex - 1] : undefined,
      options
    ),
    next: readPaginationItem(
      currentIndex < siblings.length - 1
        ? siblings[currentIndex + 1]
        : undefined,
      options
    ),
  };
}

/** Projects one lesson material into topic and concrete lesson public routes. */
function listLessonPublicRoutes(
  material: LessonMaterialSource,
  domains: NonNullable<RouteInputs["domains"]>
) {
  return Effect.gen(function* () {
    const routes: PublicContentRoute[] = [];

    for (const locale of locales) {
      const topicPath = yield* makePath([
        yield* lookupNamespaceSegment("subject", locale),
        yield* lookupDomainSlug(domains, "lesson", material.domain, locale),
        material.routeSlugs[locale],
      ]);

      routes.push(
        yield* decodeContentRoute({
          description: material.translations[locale].description,
          kind: "subject-topic",
          locale,
          materialKey: material.key,
          order: 0,
          publicPath: topicPath,
          sitemap: false,
          sourcePath: material.assetRoot,
          title: material.translations[locale].title,
        })
      );

      for (const [sectionIndex, section] of material.sections.entries()) {
        const sectionSlug = section.routeSlugs[locale];
        const sectionPath = yield* makePath([topicPath, sectionSlug]);

        routes.push(
          yield* decodeContentRoute({
            kind: "subject-lesson",
            locale,
            materialKey: material.key,
            order: sectionIndex + 1,
            parentPath: topicPath,
            publicPath: sectionPath,
            sectionKey: section.slug,
            sitemap: true,
            sourcePath: yield* makePath([material.assetRoot, section.slug]),
            title: section.translations[locale].title,
          })
        );
      }
    }

    return routes;
  });
}

/** Adapts an optional sibling lesson route to the established pagination item contract. */
function readPaginationItem(
  route: PublicContentRoute | undefined,
  options: {
    readonly toHref?: (route: PublicContentRoute) => string;
  }
) {
  if (!route) {
    return { href: "", title: "" };
  }

  return {
    href: options.toHref?.(route) ?? toLocalizedContentHref(route),
    title: route.title,
  };
}
