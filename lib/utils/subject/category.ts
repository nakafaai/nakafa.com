import type { SubjectCategory } from "@/types/subject/category";

/**
 * Gets the path to the category of the subject.
 * @param category - The category to get the path for.
 * @returns The path to the category.
 */
export function getCategoryPath(category: SubjectCategory) {
  return `/subject/${category}` as const;
}
