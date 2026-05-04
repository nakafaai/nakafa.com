import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";

/**
 * Builds the public path for an exercises category page.
 *
 * @param category - Exercises category slug
 * @returns Canonical category path
 */
export function getCategoryPath(category: ExercisesCategory) {
  return `/exercises/${category}` as const;
}

/**
 * Builds the public path for an exercises type page.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @returns Canonical type path
 */
export function getExercisesPath(
  category: ExercisesCategory,
  type: ExercisesType
) {
  return `/exercises/${category}/${type}` as const;
}

/**
 * Builds the public path for an exercises material page.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @param material - Exercises material slug
 * @returns Canonical material path
 */
export function getMaterialPath(
  category: ExercisesCategory,
  type: ExercisesType,
  material: ExercisesMaterial
) {
  return `/exercises/${category}/${type}/${material}` as const;
}

/** Narrows one exercises category route segment to the supported category union. */
export function parseExercisesCategory(value: string) {
  const parsedCategory = ExercisesCategorySchema.safeParse(value);

  if (!parsedCategory.success) {
    return null;
  }

  return parsedCategory.data;
}

/** Narrows one exercises type route segment to the supported type union. */
export function parseExercisesType(value: string) {
  const parsedType = ExercisesTypeSchema.safeParse(value);

  if (!parsedType.success) {
    return null;
  }

  return parsedType.data;
}

/** Narrows one exercises material route segment to the supported material union. */
export function parseExercisesMaterial(value: string) {
  const parsedMaterial = ExercisesMaterialSchema.safeParse(value);

  if (!parsedMaterial.success) {
    return null;
  }

  return parsedMaterial.data;
}
