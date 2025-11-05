import { getCategoryPath } from "@repo/contents/_lib/exercises/category";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { LucideIcon } from "lucide-react";

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
 * Gets the subjects for a grade.
 * @param category - The category to get the subjects for.
 * @param grade - The grade to get the subjects for.
 * @returns The subjects for the grade.
 */
export async function getSubjects(
  category: ExercisesCategory,
  type: ExercisesType
): Promise<
  {
    icon: LucideIcon;
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
