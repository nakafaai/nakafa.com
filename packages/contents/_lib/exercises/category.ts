import {
  PropertyEditIcon,
  StudyLampIcon,
  SwatchIcon,
} from "@hugeicons/core-free-icons";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";

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
 * Resolves the icon used for an exercises category.
 *
 * @param category - Exercises category slug
 * @returns Hugeicons icon for the category
 */
export function getCategoryIcon(category: ExercisesCategory) {
  switch (category) {
    case "middle-school":
      return StudyLampIcon;
    case "high-school":
      return SwatchIcon;
    default:
      return PropertyEditIcon;
  }
}

/** Narrows one exercises category route segment to the supported category union. */
export function parseExercisesCategory(value: string) {
  const parsedCategory = ExercisesCategorySchema.safeParse(value);

  if (!parsedCategory.success) {
    return null;
  }

  return parsedCategory.data;
}
