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
import type {
  MaterialLocale,
  MaterialSource,
  PracticeMaterialGroup,
} from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { Effect, Schema } from "effect";

export class CurriculumProjectionError extends Schema.TaggedError<CurriculumProjectionError>()(
  "CurriculumProjectionError",
  {
    message: Schema.String,
  }
) {}

interface CurriculumProjectionResult {
  failures: CurriculumProjectionError[];
  nodes: ProjectedCurriculumNode[];
}

export interface ProjectedCurriculumNode extends CurriculumNode {
  curriculumKey: CurriculumSource["programKey"];
}

/** Effect-native projection entrypoint for sync and script boundaries. */
export const listCurriculumNodesEffect = Effect.fn(
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

/** Returns projection issues without throwing so architecture tests can report them. */
export function getCurriculumProjectionIssues({
  curricula = CURRICULUM_SOURCES,
  materials = MATERIAL_SOURCES,
}: {
  curricula?: readonly CurriculumSource[];
  materials?: readonly MaterialSource[];
} = {}) {
  return projectCurricula({ curricula, materials }).failures.map(
    (failure) => failure.message
  );
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
  const material =
    findMaterialSourceByRoute(materials, "lesson", normalizedRoute) ??
    findMaterialSourceByRoute(materials, "practice", normalizedRoute);

  if (!material) {
    return [];
  }

  const programKeys = curriculumNodes.flatMap((node) =>
    node.materialKeys.includes(material.key) ? [node.curriculumKey] : []
  );

  return [...new Set(programKeys)].sort();
}

function projectCurricula({
  curricula,
  materials,
}: {
  curricula: readonly CurriculumSource[];
  materials: readonly MaterialSource[];
}): CurriculumProjectionResult {
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
        materialByKey,
        node: treeNode,
        nodeKeys,
        nodes,
      });
    }
  }

  return { failures, nodes };
}

function toProjectionError(failures: readonly CurriculumProjectionError[]) {
  return new CurriculumProjectionError({
    message: failures.map((failure) => failure.message).join("\n"),
  });
}

function projectTreeNode({
  curriculum,
  failures,
  materialByKey,
  node,
  nodeKeys,
  nodes,
  parentKey,
}: {
  curriculum: CurriculumSource;
  failures: CurriculumProjectionError[];
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

  const projected = toProjectedNode({
    curriculum,
    failures,
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
        materialByKey,
        node: child,
        nodeKeys,
        nodes,
        parentKey: node.key,
      });
    }
  }
}

function toProjectedNode({
  curriculum,
  failures,
  materialByKey,
  node,
  parentKey,
}: {
  curriculum: CurriculumSource;
  failures: CurriculumProjectionError[];
  materialByKey: ReadonlyMap<string, MaterialSource>;
  node: CurriculumTreeNode;
  parentKey?: string;
}) {
  if (!isMaterialReferenceNode(node)) {
    return decodeCurriculumNode({
      curriculumKey: curriculum.programKey,
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
    materialKeys: [...node.materialKeys],
    node,
    parentKey,
    translations,
  });
}

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

  if (!materialTranslations) {
    if (!node.displayOverride) {
      failures.push(
        new CurriculumProjectionError({
          message: `Curriculum node ${curriculum.programKey}:${node.key} references material ${material.key} without projectable material copy.`,
        })
      );
      return null;
    }

    return node.displayOverride;
  }

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

function readMaterialTranslations(material: MaterialSource) {
  if (material.kind === "lesson") {
    return material.translations;
  }

  if (hasSinglePracticeGroup(material.groups)) {
    const [group] = material.groups;
    return group.translations;
  }

  return null;
}

function isDuplicatedDisplay(
  override: CurriculumNodeTranslationMap,
  materialTranslations: CurriculumNodeTranslationMap
) {
  const locales: readonly MaterialLocale[] = ["en", "id"];

  return locales.every((locale) => {
    const overrideTranslation = override[locale];
    const materialTranslation = materialTranslations[locale];

    return (
      overrideTranslation.title === materialTranslation.title &&
      overrideTranslation.description === materialTranslation.description
    );
  });
}

function decodeCurriculumNode({
  curriculumKey,
  materialKeys,
  node,
  parentKey,
  translations,
}: {
  curriculumKey: CurriculumSource["programKey"];
  materialKeys: CurriculumNode["materialKeys"];
  node: CurriculumTreeNode;
  parentKey?: string;
  translations: CurriculumNodeTranslationMap;
}): ProjectedCurriculumNode {
  const nodeRow = Schema.decodeUnknownSync(CurriculumNodeSchema)({
    key: node.key,
    level: node.level,
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

function isMaterialReferenceNode(
  node: CurriculumTreeNode
): node is CurriculumMaterialReferenceNode {
  return "materialKeys" in node;
}

function hasSingleMaterial(
  materials: readonly MaterialSource[]
): materials is readonly [MaterialSource] {
  return materials.length === 1;
}

function hasSinglePracticeGroup(
  groups: readonly PracticeMaterialGroup[]
): groups is readonly [PracticeMaterialGroup] {
  return groups.length === 1;
}
