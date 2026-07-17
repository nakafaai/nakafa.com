import { listLessonMaterials } from "@repo/contents/_types/material/projection";
import type {
  LessonMaterialSource,
  MaterialLocale,
} from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";

/** Lists lesson materials owned by the source registry. */
export function listLessonMaterialSources(): LessonMaterialSource[] {
  return MATERIAL_SOURCES.filter((material) => material.kind === "lesson");
}

/** Lists sync-ready lesson projections for the requested content locale. */
export function listLessonRows(locale?: MaterialLocale) {
  return listLessonMaterials(MATERIAL_SOURCES, locale);
}
