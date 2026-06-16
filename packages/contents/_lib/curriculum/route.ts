import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import type {
  Grade,
  Material,
  SubjectCategory,
} from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

/**
 * Builds the public path for a material lesson page.
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
  return `/curriculum/${category}/${grade}/${material}` as const;
}

/** Narrows one material lesson route segment to the supported material union. */
export function parseMaterial(value: string) {
  return Schema.decodeUnknownOption(MaterialSchema)(value);
}
