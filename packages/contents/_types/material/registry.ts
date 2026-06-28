import {
  findMaterialSourceByRoute,
  listLessonMaterials,
  listPracticeMaterialSets,
  toLessonMaterialList,
  toPracticeMaterialList,
} from "@repo/contents/_types/material/projection";
import type {
  LessonMaterialSource,
  MaterialLocale,
  MaterialSource,
  PracticeMaterialSource,
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
  const material = findMaterialSourceByRoute(materials, "lesson", route);

  return material?.kind === "lesson" ? material : null;
}

/** Finds the practice material that owns one public route. */
export function findPracticeMaterial(
  route: string,
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  const material = findMaterialSourceByRoute(materials, "practice", route);

  return material?.kind === "practice" ? material : null;
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

/** Projects one route-owned practice material into localized navigation rows. */
export function getPracticeMaterialList(
  route: string,
  locale: MaterialLocale,
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  const material = findPracticeMaterial(route, materials);

  if (!material) {
    return [];
  }

  return toPracticeMaterialList(material, locale);
}

/** Lists lesson materials without exposing unrelated practice materials to callers. */
export function listLessonMaterialSources(
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
): LessonMaterialSource[] {
  return materials.filter((material) => material.kind === "lesson");
}

/** Lists practice materials without exposing unrelated lesson materials to callers. */
export function listPracticeMaterialSources(
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
): PracticeMaterialSource[] {
  return materials.filter((material) => material.kind === "practice");
}

/** Lists sync-ready lesson projections for the requested content locale. */
export function listLessonRows(locale?: MaterialLocale) {
  return listLessonMaterials(MATERIAL_SOURCES, locale);
}

/** Lists sync-ready practice set projections for the requested content locale. */
export function listPracticeSets(locale?: MaterialLocale) {
  return listPracticeMaterialSets(MATERIAL_SOURCES, locale);
}
