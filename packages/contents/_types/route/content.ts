import type { ContentPagination, Locale } from "@repo/contents/_types/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import type {
  LessonMaterialSource,
  PracticeMaterialSource,
} from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  comparePublicRouteOrder,
  decodeContentRoute,
  decodePublicPath,
  lastPathSegment,
  lookupDomainSlug,
  lookupNamespaceSegment,
  makePath,
  normalizePublicPath,
  uniqueRoutes,
} from "@repo/contents/_types/route/path";
import {
  findPublicPracticeQuestionRouteByPath,
  findPublicPracticeQuestionRouteBySourcePath,
  getPracticeSourceGroupSlug,
  makePracticeGroupPath,
} from "@repo/contents/_types/route/practice";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { locales } from "@repo/utilities/locales";
import { Effect, Option } from "effect";

/** Projects reusable material and practice sources into canonical public routes. */
export const listPublicContentRoutes = Effect.fn("contents.route.listContent")(
  function* ({
    domains = MATERIAL_ROUTE_DOMAINS,
    materials = MATERIAL_SOURCES,
  }: Pick<RouteInputs, "domains" | "materials"> = {}) {
    const routes: PublicContentRoute[] = [];

    for (const material of materials) {
      const materialRoutes =
        material.kind === "lesson"
          ? yield* listLessonPublicRoutes(material, domains)
          : yield* listPracticePublicRoutes(material, domains);

      routes.push(...materialRoutes);
    }

    return yield* uniqueRoutes(routes);
  }
);

/**
 * Finds only canonical material/practice routes for one localized public path.
 *
 * Context routes are intentionally excluded so callers that need source-backed
 * markdown cannot treat curriculum or assessment navigation pages as duplicate
 * material bodies.
 */
export const findPublicContentRouteByPath = Effect.fn(
  "contents.route.findContentByPath"
)(function* (path: string, locale: Locale, inputs: RouteInputs = {}) {
  const publicPath = yield* decodePublicPath(normalizePublicPath(path));
  const routes = yield* listPublicContentRoutes(inputs);
  const exactRoute = routes.find(
    (route) => route.locale === locale && route.publicPath === publicPath
  );

  if (exactRoute) {
    return Option.some(exactRoute);
  }

  return yield* findPublicPracticeQuestionRouteByPath({
    domains: inputs.domains ?? MATERIAL_ROUTE_DOMAINS,
    locale,
    materials: inputs.materials ?? MATERIAL_SOURCES,
    publicPath,
  });
});

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

  return yield* findPublicPracticeQuestionRouteBySourcePath({
    domains: inputs.domains ?? MATERIAL_ROUTE_DOMAINS,
    locale,
    materials: inputs.materials ?? MATERIAL_SOURCES,
    sourcePath: normalizedSourcePath,
  });
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
export function isMaterialContentRoute(route: PublicContentRoute) {
  return route.kind === "subject-topic" || route.kind === "subject-lesson";
}

/** Checks whether one content row is a concrete canonical lesson body. */
export function isMaterialLessonRoute(route: PublicContentRoute) {
  return route.kind === "subject-lesson";
}

/** Checks whether one content row is an internal material topic grouping row. */
export function isMaterialTopicRoute(route: PublicContentRoute) {
  return route.kind === "subject-topic";
}

/** Converts one projected content route to its localized public href. */
export function toLocalizedContentHref(
  route: Pick<PublicContentRoute, "locale" | "publicPath">
) {
  return `/${route.locale}/${route.publicPath}`;
}

/** Reads the localized content path without the namespace segment. */
export function readContentPathSegments(
  route: Pick<PublicContentRoute, "publicPath">
) {
  return route.publicPath.split("/").slice(1);
}

/** Reads the localized content path without the namespace as one route string. */
export function readContentPathWithoutNamespace(
  route: Pick<PublicContentRoute, "publicPath">
) {
  return readContentPathSegments(route).join("/");
}

/** Reads the local route slug of a canonical content route. */
export function readContentRouteSlug(
  route: Pick<PublicContentRoute, "publicPath">
) {
  return lastPathSegment(route.publicPath);
}

/** Finds the topic row that owns one canonical lesson body row. */
export function readParentMaterialRoute(
  route: PublicContentRoute,
  routes: readonly PublicContentRoute[]
) {
  if (!route.parentPath) {
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
  routes: readonly PublicContentRoute[]
): ContentPagination {
  const emptyItem = { href: "", title: "" };

  if (!(isMaterialLessonRoute(route) && route.parentPath)) {
    return { prev: emptyItem, next: emptyItem };
  }

  const siblings = routes
    .filter(isMaterialLessonRoute)
    .filter(
      (candidate) =>
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
      currentIndex > 0 ? siblings[currentIndex - 1] : undefined
    ),
    next: readPaginationItem(
      currentIndex < siblings.length - 1
        ? siblings[currentIndex + 1]
        : undefined
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

/** Projects one practice material into set and question public routes. */
function listPracticePublicRoutes(
  material: PracticeMaterialSource,
  domains: NonNullable<RouteInputs["domains"]>
) {
  return Effect.gen(function* () {
    const routes: PublicContentRoute[] = [];

    for (const locale of locales) {
      for (const group of material.groups) {
        const groupPath = yield* makePracticeGroupPath({
          domains,
          group,
          locale,
          material,
        });

        for (const [setIndex, set] of group.sets.entries()) {
          const setPath = yield* makePath([groupPath, set.routeSlugs[locale]]);

          routes.push(
            yield* decodeContentRoute({
              description: group.translations[locale].description,
              kind: "exercise-set",
              locale,
              materialKey: material.key,
              order: setIndex + 1,
              parentPath: groupPath,
              publicPath: setPath,
              sectionKey: set.slug,
              sitemap: true,
              sourcePath: yield* makePath([
                material.assetRoot,
                getPracticeSourceGroupSlug(group),
                set.slug,
              ]),
              title: set.translations[locale].title,
            })
          );
        }
      }
    }

    return routes;
  });
}

/** Adapts an optional sibling lesson route to the established pagination item contract. */
function readPaginationItem(route: PublicContentRoute | undefined) {
  if (!route) {
    return { href: "", title: "" };
  }

  return {
    href: toLocalizedContentHref(route),
    title: route.title,
  };
}
