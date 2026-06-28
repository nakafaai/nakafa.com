import type { AssessmentSource } from "@repo/contents/_types/assessment/schema";
import { ASSESSMENT_SOURCES } from "@repo/contents/_types/assessment/source";
import type { MaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";

/** Lists all authored assessment structures without exposing material internals. */
export function listAssessments(
  assessments: readonly AssessmentSource[] = ASSESSMENT_SOURCES
) {
  return assessments;
}

/** Returns assessment source issues that would break material-backed coverage. */
export function getAssessmentSourceIssues({
  assessments = ASSESSMENT_SOURCES,
  materials = MATERIAL_SOURCES,
}: {
  assessments?: readonly AssessmentSource[];
  materials?: readonly MaterialSource[];
} = {}) {
  const materialKeys = new Set(materials.map((material) => material.key));
  const issues: string[] = [];

  for (const assessment of assessments) {
    const nodeKeys = new Set(assessment.nodes.map((node) => node.key));

    for (const node of assessment.nodes) {
      if (node.parentKey && !nodeKeys.has(node.parentKey)) {
        issues.push(
          `Unknown parent node ${node.parentKey} in ${assessment.programKey}:${node.key}`
        );
      }

      for (const materialKey of node.materialKeys) {
        if (!materialKeys.has(materialKey)) {
          issues.push(
            `Unknown material key ${materialKey} in ${assessment.programKey}:${node.key}`
          );
        }
      }
    }
  }

  return issues;
}
