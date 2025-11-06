import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";

/**
 * Gets the path to a exercises material based on its category, type, material, and slug.
 * @param category - The category of the subject.
 * @param type - The type of the subject.
 * @param material - The material of the exercises.
 * @param slug - The slug of the exercises.
 * @returns The path to the exercises material.
 */
export function getSlugPath(
  category: ExercisesCategory,
  type: ExercisesType,
  material: ExercisesMaterial,
  slug: string[]
) {
  return `/exercises/${category}/${type}/${material}/${slug.join("/")}` as const;
}
