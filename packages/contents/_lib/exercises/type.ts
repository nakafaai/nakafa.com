import { getCategoryPath } from "@repo/contents/_lib/exercises/category";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";

/**
 * Gets the path to the type of the exercises.
 * @param category - The category to get the path for.
 * @param type - The type to get the path for.
 * @returns The path to the type.
 */
export function getExercisesPath(
  category: ExercisesCategory,
  type: ExercisesType
) {
  return `/exercises/${category}/${type}` as const;
}

/**
 * Gets the subjects (materials) for a given category and type.
 * Imports and calls the getSubjects function from the category's _data/subject.ts.
 *
 * @param category - Exercise category (e.g., "high-school")
 * @param type - Exercise type (e.g., "tka", "tkb")
 * @returns Array of subject objects with label and href
 *
 * @example
 * ```ts
 * const subjects = await getSubjects("high-school", "tka");
 * // Returns: [{ label: "mathematics", href: "/exercises/high-school/tka/mathematics" }, ...]
 * ```
 */
export async function getSubjects(
  category: ExercisesCategory,
  type: ExercisesType
): Promise<
  {
    label: ExercisesMaterial;
    href: string;
  }[]
> {
  try {
    const gradePath = getCategoryPath(category);

    const cleanPath = gradePath.startsWith("/")
      ? gradePath.substring(1)
      : gradePath;

    const gradeModule = await import(
      `@repo/contents/${cleanPath}/_data/subject.ts`
    );

    return gradeModule.getSubjects(type);
  } catch {
    return [];
  }
}
