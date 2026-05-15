import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import { Option, Schema } from "effect";

/**
 * Builds the public path for a subject material page.
 *
 * @param category - Subject category slug
 * @param grade - Grade slug within the category
 * @param material - Material slug within the grade
 * @returns Canonical material path
 */
export function getMaterialPath(
  category: SubjectCategory,
  grade: Grade,
  material: Material
) {
  return `/subject/${category}/${grade}/${material}` as const;
}

/** Narrows one subject material route segment to the supported material union. */
export function parseMaterial(value: string) {
  const parsedMaterial = Schema.decodeUnknownOption(MaterialSchema)(value);

  if (Option.isNone(parsedMaterial)) {
    return null;
  }

  return parsedMaterial.value;
}
