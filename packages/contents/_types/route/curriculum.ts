import type { Locale } from "@repo/contents/_types/content";
import {
  type ProjectedCurriculumNode,
  projectCurriculumNodes,
} from "@repo/contents/_types/curriculum/projection";
import type { CurriculumSource } from "@repo/contents/_types/curriculum/schema";
import { CURRICULUM_SOURCES } from "@repo/contents/_types/curriculum/source";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import { createTopicRouteByMaterialKey } from "@repo/contents/_types/route/content";
import { InvalidPublicRouteSourceError } from "@repo/contents/_types/route/error";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  decodeCurriculumRoute,
  getParentPath,
  lastPathSegment,
  lookupNamespaceSegment,
  makePath,
  uniqueRoutes,
} from "@repo/contents/_types/route/path";
import { findProgram } from "@repo/contents/_types/route/program";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
} from "@repo/contents/_types/route/schema";
import type { PublicRouteSegment } from "@repo/contents/_types/route/segment";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";

const RENDERABLE_CURRICULUM_LEVELS = new Set<PublicCurriculumRoute["level"]>([
  "class",
  "course",
  "framework",
  "qualification",
  "stage",
  "subject",
  "track",
]);

/** Projects curriculum-owned structure into localized navigation/context routes. */
export const listPublicCurriculumRoutes = Effect.fn(
  "contents.route.listCurricula"
)(function* ({
  curricula = CURRICULUM_SOURCES,
  curriculumNodes,
  domains = MATERIAL_ROUTE_DOMAINS,
  materials = MATERIAL_SOURCES,
  programs = LEARNING_PROGRAM_CATALOG,
}: RouteInputs = {}) {
  const contentRouteByMaterialKey = yield* createTopicRouteByMaterialKey({
    domains,
    materials,
  });
  const projectedNodes =
    curriculumNodes ??
    (yield* projectCurriculumNodes({ curricula, materials }).pipe(
      Effect.mapError(
        (error) =>
          new InvalidPublicRouteSourceError({
            message: error.message,
          })
      )
    ));
  const nodeByKey = createCurriculumNodeMap(projectedNodes);
  const descendantMaterials = createDescendantMaterialMap(projectedNodes);
  const routes: PublicCurriculumRoute[] = [];

  for (const curriculum of curricula) {
    const program = yield* findProgram(curriculum.programKey, programs);
    const hasMaterialDescendant = hasCurriculumMaterialDescendant(
      curriculum,
      descendantMaterials
    );

    for (const locale of locales) {
      const namespace = yield* lookupNamespaceSegment("curriculum", locale);
      const programPath = yield* makePath([
        namespace,
        program.translations[locale].publicSlug,
      ]);

      routes.push(
        yield* decodeCurriculumRoute({
          kind: "curriculum-context",
          iconKey: program.iconKey,
          level: "track",
          locale,
          nodeKey: `${program.key}:root`,
          order: program.displayOrder,
          programKey: program.key,
          publicPath: programPath,
          sitemap: hasMaterialDescendant,
          title: program.translations[locale].title,
        })
      );
    }
  }

  for (const node of projectedNodes) {
    const materialKeys = new Set(
      descendantMaterials.get(getCurriculumNodeMapKey(node))
    );

    const program = yield* findProgram(node.curriculumKey, programs);

    for (const locale of locales) {
      const pathSegments = yield* getCurriculumNodePathSegments({
        contentRouteByMaterialKey,
        locale,
        node,
        nodeByKey,
      });

      const namespace = yield* lookupNamespaceSegment("curriculum", locale);
      const programPath = yield* makePath([
        namespace,
        program.translations[locale].publicSlug,
      ]);
      const publicPath = yield* makePath([programPath, ...pathSegments]);
      const materialKey = node.materialKeys.at(0);
      const canonicalPath = materialKey
        ? contentRouteByMaterialKey.get(`${locale}:${materialKey}`)?.publicPath
        : undefined;

      routes.push(
        yield* decodeCurriculumRoute({
          canonicalPath,
          displayGroupIconKey: node.displayGroupIconKey,
          displayGroupTitle: node.displayGroup?.[locale].title,
          iconKey: node.iconKey,
          kind: "curriculum-context",
          level: node.level,
          locale,
          materialDomain: node.materialDomain,
          materialKey,
          nodeKey: node.key,
          order: node.order,
          parentPath: getParentPath(publicPath),
          programKey: node.curriculumKey,
          publicPath,
          sitemap:
            RENDERABLE_CURRICULUM_LEVELS.has(node.level) &&
            materialKeys.size > 0,
          title: node.translations[locale].title,
        })
      );
    }
  }

  return yield* uniqueRoutes(routes);
});

/** Checks whether a curriculum route has ready mapped content for public navigation. */
export function isRenderableCurriculumRoute(route: PublicCurriculumRoute) {
  return RENDERABLE_CURRICULUM_LEVELS.has(route.level) && route.sitemap;
}

/** Orders sibling curriculum routes from source-owned curriculum order data. */
export function compareCurriculumRouteOrder(
  left: PublicCurriculumRoute,
  right: PublicCurriculumRoute
) {
  const orderDifference = left.order - right.order;

  if (orderDifference !== 0) {
    return orderDifference;
  }

  return left.publicPath.localeCompare(right.publicPath);
}

/** Finds one curriculum route by locale and projected public path. */
export function readCurriculumRouteByPublicPath(
  routes: readonly PublicCurriculumRoute[],
  locale: PublicCurriculumRoute["locale"],
  publicPath: PublicCurriculumRoute["publicPath"]
) {
  return routes.find(
    (candidate) =>
      candidate.locale === locale && candidate.publicPath === publicPath
  );
}

/** Reads visible projected ancestors without reconstructing URL segments. */
export function readCurriculumAncestors(
  route: PublicCurriculumRoute,
  routes: readonly PublicCurriculumRoute[]
) {
  const ancestors: PublicCurriculumRoute[] = [];
  let parentPath = route.parentPath;

  while (parentPath) {
    const parent = readCurriculumRouteByPublicPath(
      routes,
      route.locale,
      parentPath
    );

    if (!parent) {
      break;
    }

    ancestors.unshift(parent);
    parentPath = parent.parentPath;
  }

  return ancestors;
}

/** Builds the lookup key used for projected curriculum node ancestry. */
export function getCurriculumNodeMapKey(node: ProjectedCurriculumNode) {
  return `${node.curriculumKey}:${node.key}`;
}

/** Indexes curriculum nodes by curriculum-qualified node key. */
export function createCurriculumNodeMap(
  nodes: readonly ProjectedCurriculumNode[]
) {
  return new Map(nodes.map((node) => [getCurriculumNodeMapKey(node), node]));
}

/** Tracks material availability through each curriculum ancestor. */
export function createDescendantMaterialMap(
  nodes: readonly ProjectedCurriculumNode[]
) {
  const nodeByKey = createCurriculumNodeMap(nodes);
  const descendantMaterials = new Map<string, Set<string>>();

  for (const node of nodes) {
    const materialKeys =
      descendantMaterials.get(getCurriculumNodeMapKey(node)) ??
      new Set<string>();

    for (const materialKey of node.materialKeys) {
      materialKeys.add(materialKey);
    }

    descendantMaterials.set(getCurriculumNodeMapKey(node), materialKeys);

    let current = node.parentKey
      ? nodeByKey.get(`${node.curriculumKey}:${node.parentKey}`)
      : undefined;

    while (current) {
      const key = getCurriculumNodeMapKey(current);
      const ancestorMaterialKeys =
        descendantMaterials.get(key) ?? new Set<string>();

      for (const materialKey of node.materialKeys) {
        ancestorMaterialKeys.add(materialKey);
      }

      descendantMaterials.set(key, ancestorMaterialKeys);
      current = current.parentKey
        ? nodeByKey.get(`${current.curriculumKey}:${current.parentKey}`)
        : undefined;
    }
  }

  return descendantMaterials;
}

/** Checks whether a curriculum has renderable mapped material below its root. */
function hasCurriculumMaterialDescendant(
  curriculum: CurriculumSource,
  descendantMaterials: ReadonlyMap<string, ReadonlySet<string>>
) {
  return [...descendantMaterials.entries()].some(
    ([key, materialKeys]) =>
      key.startsWith(`${curriculum.programKey}:`) && materialKeys.size > 0
  );
}

/** Builds curriculum context path segments from source ancestry and canonical leaves. */
function getCurriculumNodePathSegments({
  contentRouteByMaterialKey,
  locale,
  node,
  nodeByKey,
}: {
  contentRouteByMaterialKey: ReadonlyMap<string, PublicContentRoute>;
  locale: Locale;
  node: ProjectedCurriculumNode;
  nodeByKey: ReadonlyMap<string, ProjectedCurriculumNode>;
}) {
  return Effect.gen(function* () {
    const nodes: ProjectedCurriculumNode[] = [];
    let current: ProjectedCurriculumNode | undefined = node;

    while (current) {
      nodes.unshift(current);
      current = current.parentKey
        ? nodeByKey.get(`${current.curriculumKey}:${current.parentKey}`)
        : undefined;
    }

    const segments: PublicRouteSegment[] = [];

    for (const item of nodes) {
      const materialKey = item.materialKeys.at(0);
      const materialRoute = materialKey
        ? contentRouteByMaterialKey.get(`${locale}:${materialKey}`)
        : undefined;

      if (materialRoute) {
        segments.push(yield* lastPathSegment(materialRoute.publicPath));
        continue;
      }

      segments.push(item.translations[locale].routeSlug);
    }

    return segments;
  });
}
