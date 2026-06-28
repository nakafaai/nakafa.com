import type { Locale } from "@repo/contents/_types/content";
import {
  listCurriculumNodes,
  type ProjectedCurriculumNode,
} from "@repo/contents/_types/curriculum/projection";
import { CURRICULUM_SOURCES } from "@repo/contents/_types/curriculum/source";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import {
  type LearningProgram,
  LearningProgramSchema,
} from "@repo/contents/_types/program/schema";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import {
  compareCurriculumRouteOrder,
  createCurriculumNodeMap,
  createDescendantMaterialMap,
  getCurriculumNodeMapKey,
  hasCurriculumMaterialDescendant,
  isRenderableCurriculumLevel,
  readCurriculumRouteIconKey,
} from "@repo/contents/_types/route/curriculum";
import {
  getParentPath,
  lastPathSegmentSync,
  makePathSync,
  readNamespaceSegment,
} from "@repo/contents/_types/route/path";
import {
  type PublicContentRoute,
  type PublicCurriculumRoute,
  PublicCurriculumRouteSchema,
} from "@repo/contents/_types/route/schema";
import type { PublicRouteSegment } from "@repo/contents/_types/route/segment";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

/**
 * Projects the default curriculum registry for static Next route helpers.
 *
 * This pure reader mirrors the source-owned Effect projection for the already
 * decoded default registries. It avoids creating Effect fibers while Next
 * builds `generateStaticParams` under Cache Components.
 */
export function readStaticPublicCurriculumRoutes() {
  const contentRouteByMaterialKey = createStaticTopicRouteByMaterialKey();
  const projectedNodes = listCurriculumNodes();
  const nodeByKey = createCurriculumNodeMap(projectedNodes);
  const descendantMaterials = createDescendantMaterialMap(projectedNodes);
  const routes: PublicCurriculumRoute[] = [];

  for (const curriculum of CURRICULUM_SOURCES) {
    const program = readStaticProgram(curriculum.programKey);
    const hasMaterialDescendant = hasCurriculumMaterialDescendant(
      curriculum,
      descendantMaterials
    );

    for (const locale of locales) {
      const programPath = makePathSync([
        readNamespaceSegment("curriculum", locale),
        program.translations[locale].publicSlug,
      ]);

      routes.push(
        Schema.decodeUnknownSync(PublicCurriculumRouteSchema)({
          iconKey: program.iconKey,
          kind: "curriculum-context",
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
    const program = readStaticProgram(node.curriculumKey);

    for (const locale of locales) {
      const pathSegments = readStaticCurriculumNodePathSegments({
        contentRouteByMaterialKey,
        locale,
        node,
        nodeByKey,
      });
      const programPath = makePathSync([
        readNamespaceSegment("curriculum", locale),
        program.translations[locale].publicSlug,
      ]);
      const publicPath = makePathSync([programPath, ...pathSegments]);
      const materialKey = node.materialKeys.at(0);
      const canonicalPath = materialKey
        ? contentRouteByMaterialKey.get(`${locale}:${materialKey}`)?.publicPath
        : undefined;

      routes.push(
        Schema.decodeUnknownSync(PublicCurriculumRouteSchema)({
          canonicalPath,
          displayGroupIconKey: node.displayGroupIconKey,
          displayGroupTitle: node.displayGroup?.[locale].title,
          iconKey: readCurriculumRouteIconKey(node, program),
          kind: "curriculum-context",
          level: node.level,
          locale,
          materialCardDescription: node.materialCard?.[locale].description,
          materialCardTitle: node.materialCard?.[locale].title,
          materialDomain: node.materialDomain,
          materialKey,
          nodeKey: node.key,
          order: node.order,
          parentPath: getParentPath(publicPath),
          programKey: node.curriculumKey,
          publicPath,
          sitemap:
            isRenderableCurriculumLevel(node.level) && materialKeys.size > 0,
          title: node.translations[locale].title,
        })
      );
    }
  }

  return routes.sort(compareCurriculumRouteOrder);
}

/** Indexes default material topic rows for pure static curriculum projection. */
function createStaticTopicRouteByMaterialKey() {
  const topicRouteByMaterialKey = new Map<string, PublicContentRoute>();

  for (const route of readStaticPublicContentRoutes()) {
    if (route.kind !== "subject-topic") {
      continue;
    }

    topicRouteByMaterialKey.set(`${route.locale}:${route.materialKey}`, route);
  }

  return topicRouteByMaterialKey;
}

/** Finds a decoded learning program for pure static curriculum projection. */
function readStaticProgram(programKey: LearningProgram["key"]) {
  return Schema.decodeUnknownSync(LearningProgramSchema)(
    LEARNING_PROGRAM_CATALOG.find((candidate) => candidate.key === programKey)
  );
}

/** Builds curriculum path segments without starting an Effect runtime. */
function readStaticCurriculumNodePathSegments({
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

    segments.push(
      materialRoute
        ? lastPathSegmentSync(materialRoute.publicPath)
        : item.translations[locale].routeSlug
    );
  }

  return segments;
}
