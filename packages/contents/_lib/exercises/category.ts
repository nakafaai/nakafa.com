import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import { BookCopyIcon, SwatchBookIcon } from "lucide-react";

/**
 * Gets the path to the category of the subject.
 * @param category - The category to get the path for.
 * @returns The path to the category.
 */
export function getCategoryPath(category: ExercisesCategory) {
  return `/exercises/${category}` as const;
}

/**
 * Gets the icon for the category of the exercises.
 * @param category - The category to get the icon for.
 * @returns The icon for the category.
 */
export function getCategoryIcon(category: ExercisesCategory) {
  switch (category) {
    case "high-school":
      return SwatchBookIcon;
    default:
      return BookCopyIcon;
  }
}
