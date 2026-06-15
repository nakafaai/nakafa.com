import {
  findMaterialSourceByRoute,
  listExerciseMaterialSets,
  listSubjectMaterialTopics,
  toExerciseMaterialList,
  toSubjectMaterialList,
} from "@repo/contents/_types/material/projection";
import type {
  ExerciseMaterialSource,
  MaterialLocale,
  MaterialSource,
  SubjectMaterialSource,
} from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";

/** Returns all typed pedagogical materials owned by the source registry. */
export function listMaterials(
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  return materials;
}

/** Finds the subject material that owns one public route. */
export function findSubjectMaterial(
  route: string,
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  const material = findMaterialSourceByRoute(materials, "subject", route);

  return material?.kind === "subject" ? material : null;
}

/** Finds the exercise material that owns one public route. */
export function findExerciseMaterial(
  route: string,
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  const material = findMaterialSourceByRoute(materials, "exercise", route);

  return material?.kind === "exercise" ? material : null;
}

/** Projects one route-owned subject material into localized navigation rows. */
export function getSubjectMaterialList(
  route: string,
  locale: MaterialLocale,
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  const material = findSubjectMaterial(route, materials);

  if (!material) {
    return [];
  }

  return toSubjectMaterialList(material, locale);
}

/** Projects one route-owned exercise material into localized navigation rows. */
export function getExerciseMaterialList(
  route: string,
  locale: MaterialLocale,
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
) {
  const material = findExerciseMaterial(route, materials);

  if (!material) {
    return [];
  }

  return toExerciseMaterialList(material, locale);
}

/** Lists subject materials without exposing unrelated exercise materials to callers. */
export function listSubjectMaterials(
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
): SubjectMaterialSource[] {
  return materials.filter((material) => material.kind === "subject");
}

/** Lists exercise materials without exposing unrelated subject materials to callers. */
export function listExerciseMaterials(
  materials: readonly MaterialSource[] = MATERIAL_SOURCES
): ExerciseMaterialSource[] {
  return materials.filter((material) => material.kind === "exercise");
}

/** Lists sync-ready subject topic projections for the requested content locale. */
export function listSubjectTopics(locale?: MaterialLocale) {
  return listSubjectMaterialTopics(MATERIAL_SOURCES, locale);
}

/** Lists sync-ready exercise set projections for the requested content locale. */
export function listExerciseSets(locale?: MaterialLocale) {
  return listExerciseMaterialSets(MATERIAL_SOURCES, locale);
}
