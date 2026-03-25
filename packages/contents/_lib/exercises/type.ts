import { getCategoryPath } from "@repo/contents/_lib/exercises/category";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";

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
 * Loads the material list for a given exercises category and type.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @returns Material list with labels and href values, or an empty array when unavailable
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
      ? gradePath.slice(1)
      : gradePath;

    const gradeModule = await import(
      `@repo/contents/${cleanPath}/_data/subject.ts`
    );

    return gradeModule.getSubjects(type);
  } catch {
    return [];
  }
}
