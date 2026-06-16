import type { CurriculumSource } from "@repo/contents/_types/curriculum/schema";
import { CURRICULUM_SOURCES } from "@repo/contents/_types/curriculum/source";
import {
  findMaterialSourceByRoute,
  normalizeMaterialRoute,
} from "@repo/contents/_types/material/projection";
import type { MaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";

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
  const normalizedRoute = normalizeMaterialRoute(route);
  const material =
    findMaterialSourceByRoute(materials, "lesson", normalizedRoute) ??
    findMaterialSourceByRoute(materials, "practice", normalizedRoute);

  if (!material) {
    return [];
  }

  const programKeys = curricula.flatMap((curriculum) => {
    const hasMaterial = curriculum.nodes.some((node) =>
      node.materialKeys.includes(material.key)
    );

    return hasMaterial ? [curriculum.programKey] : [];
  });

  return [...new Set(programKeys)].sort();
}
