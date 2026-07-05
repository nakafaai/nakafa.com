import {
  findMaterialSourceByRoute,
  listLessonMaterials,
  toLessonMaterialList,
} from "@repo/contents/_types/material/projection";
import type {
  LessonMaterialSource,
  MaterialLocale,
  MaterialSource,
} from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";

/** Returns all typed pedagogical materials owned by the source registry. */
export function listMaterials(
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  return materials;
}

/** Finds the lesson material that owns one public route. */
export function findLessonMaterial(
  route: string,
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  const material = findMaterialSourceByRoute(materials, route);

  return material?.kind === "lesson" ? material : null;
}

/** Projects one route-owned lesson material into localized navigation rows. */
export function getLessonMaterialList(
  route: string,
  locale: MaterialLocale,
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  const material = findLessonMaterial(route, materials);

  if (!material) {
    return [];
  }

  return toLessonMaterialList(material, locale);
}

/** Lists lesson materials owned by the source registry. */
export function listLessonMaterialSources(
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
): LessonMaterialSource[] {
  return materials.filter((material) => material.kind === "lesson");
}

/** Lists sync-ready lesson projections for the requested content locale. */
export function listLessonRows(locale?: MaterialLocale) {
  return listLessonMaterials(MATERIAL_SOURCES, locale);
}
