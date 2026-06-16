import { getCurriculumProjectionIssues } from "@repo/contents/_types/curriculum/projection";
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
  return getCurriculumProjectionIssues({ curricula, materials });
}
