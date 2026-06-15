import type { CurriculumSource } from "@repo/contents/_types/curriculum/schema";
import { CURRICULUM_SOURCES } from "@repo/contents/_types/curriculum/source";
import type { MaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";

/** Lists all authored curricula without exposing material implementation details. */
export function listCurricula(
  curricula: readonly CurriculumSource[] = CURRICULUM_SOURCES
) {
  return curricula;
}

/** Returns curriculum source issues that would break material-backed coverage. */
export function getCurriculumSourceIssues({
  curricula = CURRICULUM_SOURCES,
  materials = MATERIAL_SOURCES,
}: {
  curricula?: readonly CurriculumSource[];
  materials?: readonly MaterialSource[];
} = {}) {
  const materialKeys = new Set(materials.map((material) => material.key));
  const issues: string[] = [];

  for (const curriculum of curricula) {
    const nodeKeys = new Set(curriculum.nodes.map((node) => node.key));

    for (const node of curriculum.nodes) {
      if (node.parentKey && !nodeKeys.has(node.parentKey)) {
        issues.push(
          `Unknown parent node ${node.parentKey} in ${curriculum.programKey}:${node.key}`
        );
      }

      for (const materialKey of node.materialKeys) {
        if (!materialKeys.has(materialKey)) {
          issues.push(
            `Unknown material key ${materialKey} in ${curriculum.programKey}:${node.key}`
          );
        }
      }
    }
  }

  return issues;
}
