import {
  type CurriculumMaterialReferenceNode,
  type CurriculumNode,
  CurriculumNodeSchema,
  type CurriculumNodeTranslationMap,
  type CurriculumSource,
  type CurriculumTreeNode,
} from "@repo/contents/_types/curriculum/schema";
import { CURRICULUM_SOURCES } from "@repo/contents/_types/curriculum/source";
import {
  findMaterialSourceByRoute,
  normalizeMaterialRoute,
} from "@repo/contents/_types/material/projection";
import type { MaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

export class CurriculumProjectionError extends Schema.TaggedError<CurriculumProjectionError>()(
  "CurriculumProjectionError",
  {
    message: Schema.String,
  }
) {}

export const ProjectedCurriculumNodeSchema = Schema.extend(
  CurriculumNodeSchema,
  Schema.Struct({
    curriculumKey: LearningProgramKeySchema,
  })
);

export type ProjectedCurriculumNode = Schema.Schema.Type<
  typeof ProjectedCurriculumNodeSchema
>;

/** Effect-native projection entrypoint for sync and script boundaries. */
export const projectCurriculumNodes = Effect.fn(
  "contents.curriculum.listNodes"
)(function* ({
  curricula = CURRICULUM_SOURCES,
  materials = MATERIAL_SOURCES,
}: {
  curricula?: readonly CurriculumSource[];
  materials?: readonly MaterialSource[];
} = {}) {
  const result = projectCurricula({ curricula, materials });

  if (result.failures.length > 0) {
    return yield* Effect.fail(toProjectionError(result.failures));
  }

  return result.nodes;
});

/** Projects every authored curriculum tree into generated flat read-model rows. */
export function listCurriculumNodes({
  curricula = CURRICULUM_SOURCES,
  materials = MATERIAL_SOURCES,
}: {
  curricula?: readonly CurriculumSource[];
  materials?: readonly MaterialSource[];
} = {}) {
  const result = projectCurricula({ curricula, materials });

  if (result.failures.length > 0) {
    throw toProjectionError(result.failures);
  }

  return result.nodes;
}

/** Finds canonical program keys whose curriculum mapping includes this material route. */
export function getProgramKeysForMaterialRoute({
  curricula = CURRICULUM_SOURCES,
  materials = MATERIAL_SOURCES,
  route,
}: {
  curricula?: readonly CurriculumSource[];
  materials?: readonly MaterialSource[];
  route: string;
}) {
  const curriculumNodes = listCurriculumNodes({ curricula, materials });

  return getProgramKeysForMaterialRouteFromNodes({
    curriculumNodes,
    materials,
    route,
  });
}

/** Finds canonical program keys from already projected curriculum nodes. */
export function getProgramKeysForMaterialRouteFromNodes({
  curriculumNodes,
  materials = MATERIAL_SOURCES,
  route,
}: {
  curriculumNodes: readonly ProjectedCurriculumNode[];
  materials?: readonly MaterialSource[];
  route: string;
}) {
  const normalizedRoute = normalizeMaterialRoute(route);
  const material = findMaterialSourceByRoute(materials, normalizedRoute);

  if (!material) {
    return [];
  }

  const programKeys = curriculumNodes.flatMap((node) =>
    node.materialKeys.includes(material.key) ? [node.curriculumKey] : []
  );

  return [...new Set(programKeys)].sort();
}

/** Projects authored curriculum trees while collecting every source violation in one pass. */
function projectCurricula({
  curricula,
  materials,
}: {
  curricula: readonly CurriculumSource[];
  materials: readonly MaterialSource[];
}) {
  const materialByKey = new Map(
    materials.map((material) => [material.key, material])
  );
  const failures: CurriculumProjectionError[] = [];
  const nodes: ProjectedCurriculumNode[] = [];

  for (const curriculum of curricula) {
    const nodeKeys = new Set<string>();

    for (const treeNode of curriculum.tree) {
      projectTreeNode({
        curriculum,
        failures,
        inheritedMaterialDomain: undefined,
        materialByKey,
        node: treeNode,
        nodeKeys,
        nodes,
      });
    }
  }

  return { failures, nodes };
}

/** Combines source validation failures while preserving every curriculum issue. */
function toProjectionError(failures: readonly CurriculumProjectionError[]) {
  return new CurriculumProjectionError({
    message: failures.map((failure) => failure.message).join("\n"),
  });
}

/** Walks one curriculum subtree, preserving ancestor order and inherited material domain identity. */
function projectTreeNode({
  curriculum,
  failures,
  inheritedMaterialDomain,
  materialByKey,
  node,
  nodeKeys,
  nodes,
  parentKey,
}: {
  curriculum: CurriculumSource;
  failures: CurriculumProjectionError[];
  inheritedMaterialDomain: CurriculumNode["materialDomain"] | undefined;
  materialByKey: ReadonlyMap<string, MaterialSource>;
  node: CurriculumTreeNode;
  nodeKeys: Set<string>;
  nodes: ProjectedCurriculumNode[];
  parentKey?: string;
}) {
  if (nodeKeys.has(node.key)) {
    failures.push(
      new CurriculumProjectionError({
        message: `Duplicate curriculum node ${node.key} in ${curriculum.programKey}`,
      })
    );
    return;
  }

  nodeKeys.add(node.key);

  const materialDomain = isMaterialReferenceNode(node)
    ? inheritedMaterialDomain
    : (node.materialDomain ?? inheritedMaterialDomain);
  const projected = toProjectedNode({
    curriculum,
    failures,
    materialDomain,
    materialByKey,
    node,
    parentKey,
  });

  if (projected) {
    nodes.push(projected);
  }

  if ("children" in node && node.children) {
    for (const child of node.children) {
      projectTreeNode({
        curriculum,
        failures,
        inheritedMaterialDomain: materialDomain,
        materialByKey,
        node: child,
        nodeKeys,
        nodes,
        parentKey: node.key,
      });
    }
  }
}

/** Converts one authored structure or material reference node into the flat generated row shape. */
function toProjectedNode({
  curriculum,
  failures,
  materialDomain,
  materialByKey,
  node,
  parentKey,
}: {
  curriculum: CurriculumSource;
  failures: CurriculumProjectionError[];
  materialDomain: CurriculumNode["materialDomain"] | undefined;
  materialByKey: ReadonlyMap<string, MaterialSource>;
  node: CurriculumTreeNode;
  parentKey?: string;
}) {
  if (!isMaterialReferenceNode(node)) {
    return decodeCurriculumNode({
      curriculumKey: curriculum.programKey,
      materialDomain,
      materialKeys: [],
      node,
      parentKey,
      translations: node.translations,
    });
  }

  const translations = resolveMaterialReferenceTranslations({
    curriculum,
    failures,
    materialByKey,
    node,
  });

  if (!translations) {
    return null;
  }

  return decodeCurriculumNode({
    curriculumKey: curriculum.programKey,
    materialDomain,
    materialKeys: [...node.materialKeys],
    node,
    parentKey,
    translations,
  });
}

/** Resolves curriculum leaf copy from material source truth or explicit multi-material overrides. */
function resolveMaterialReferenceTranslations({
  curriculum,
  failures,
  materialByKey,
  node,
}: {
  curriculum: CurriculumSource;
  failures: CurriculumProjectionError[];
  materialByKey: ReadonlyMap<string, MaterialSource>;
  node: CurriculumMaterialReferenceNode;
}) {
  const materials: MaterialSource[] = [];

  for (const materialKey of node.materialKeys) {
    const material = materialByKey.get(materialKey);

    if (!material) {
      failures.push(
        new CurriculumProjectionError({
          message: `Unknown material key ${materialKey} in ${curriculum.programKey}:${node.key}`,
        })
      );
      continue;
    }

    materials.push(material);
  }

  if (materials.length !== node.materialKeys.length) {
    return null;
  }

  if (node.materialKeys.length > 1) {
    if (!node.displayOverride) {
      failures.push(
        new CurriculumProjectionError({
          message: `Multi-material curriculum node ${curriculum.programKey}:${node.key} must define displayOverride.`,
        })
      );
      return null;
    }

    return node.displayOverride;
  }

  if (!hasSingleMaterial(materials)) {
    failures.push(
      new CurriculumProjectionError({
        message: `Curriculum node ${curriculum.programKey}:${node.key} must reference at least one material key.`,
      })
    );
    return null;
  }

  const [material] = materials;
  const materialTranslations = readMaterialTranslations(material);

  if (
    node.displayOverride &&
    isDuplicatedDisplay(node.displayOverride, materialTranslations)
  ) {
    failures.push(
      new CurriculumProjectionError({
        message: `Single-material curriculum node ${curriculum.programKey}:${node.key} duplicates material display copy.`,
      })
    );
    return null;
  }

  return node.displayOverride ?? materialTranslations;
}

/** Reads learner-facing copy from material sources when a curriculum leaf maps to one material. */
function readMaterialTranslations(
  material: MaterialSource
): CurriculumNodeTranslationMap {
  return {
    en: {
      routeSlug: material.routeSlugs.en,
      title: material.translations.en.title,
    },
    id: {
      routeSlug: material.routeSlugs.id,
      title: material.translations.id.title,
    },
  };
}

/** Detects forbidden single-material overrides that repeat material-owned display copy. */
function isDuplicatedDisplay(
  override: CurriculumNodeTranslationMap,
  materialTranslations: CurriculumNodeTranslationMap
) {
  return locales.every((locale) => {
    const overrideTranslation = override[locale];
    const materialTranslation = materialTranslations[locale];

    return (
      overrideTranslation.title === materialTranslation.title &&
      overrideTranslation.routeSlug === materialTranslation.routeSlug
    );
  });
}

/** Decodes the generated row through the curriculum node schema before it leaves projection. */
function decodeCurriculumNode({
  curriculumKey,
  materialDomain,
  materialKeys,
  node,
  parentKey,
  translations,
}: {
  curriculumKey: CurriculumSource["programKey"];
  materialDomain: CurriculumNode["materialDomain"] | undefined;
  materialKeys: CurriculumNode["materialKeys"];
  node: CurriculumTreeNode;
  parentKey?: string;
  translations: CurriculumNodeTranslationMap;
}): ProjectedCurriculumNode {
  const nodeRow = Schema.decodeUnknownSync(CurriculumNodeSchema)({
    displayGroup: "displayGroup" in node ? node.displayGroup : undefined,
    displayGroupIconKey:
      "displayGroupIconKey" in node ? node.displayGroupIconKey : undefined,
    iconKey: "iconKey" in node ? node.iconKey : undefined,
    key: node.key,
    level: node.level,
    materialCard: "materialCard" in node ? node.materialCard : undefined,
    materialDomain,
    materialKeys,
    order: node.order,
    parentKey,
    translations,
  });

  return {
    ...nodeRow,
    curriculumKey,
  };
}

/** Narrows tree nodes that own material references instead of structure only. */
function isMaterialReferenceNode(
  node: CurriculumTreeNode
): node is CurriculumMaterialReferenceNode {
  return "materialKeys" in node;
}

/** Narrows one-material leaves so projection can inherit material copy safely. */
function hasSingleMaterial(
  materials: readonly MaterialSource[]
): materials is readonly [MaterialSource] {
  return materials.length === 1;
}
