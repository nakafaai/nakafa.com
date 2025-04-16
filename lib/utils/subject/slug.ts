import type { ContentPagination } from "@/types/content";
import type { SubjectCategory } from "@/types/subject/category";
import type { Grade } from "@/types/subject/grade";
import type { MaterialGrade, MaterialList } from "@/types/subject/material";

/**
 * Gets the path to a subject material based on its category, grade, material, and slug.
 * @param category - The category of the subject.
 * @param grade - The grade of the subject.
 * @param material - The material of the subject.
 * @param slug - The slug of the subject.
 * @returns The path to the subject material.
 */
export function getSlugPath(
  category: SubjectCategory,
  grade: Grade,
  material: MaterialGrade,
  slug: string[]
) {
  return `/subject/${category}/${grade}/${material}/${slug.join("/")}` as const;
}

/**
 * Gets the previous and next materials for pagination based on the current path.
 *
 * @param currentPath - The current path/URL being viewed
 * @param materials - List of material subjects and their items
 * @returns Object containing previous and next navigation items with empty strings if not available
 *
 * Time Complexity: O(n) where n is total number of items across all subjects
 */
export function getMaterialsPagination(
  currentPath: string,
  materials: MaterialList
): ContentPagination {
  // Default empty navigation item
  const emptyItem = { href: "", title: "" };

  // Flatten all items from all subjects into a single array with subject information
  const allItems = materials.flatMap((subject) =>
    subject.items.map((item) => ({
      ...item,
    }))
  );

  // Find the index of the current item in the flattened array
  const currentIndex = allItems.findIndex((item) => item.href === currentPath);

  // If the current path is not found, return empty items
  if (currentIndex === -1) {
    return { prev: emptyItem, next: emptyItem };
  }

  // Extract navigation data from an item or return empty values if not available
  const getItemData = (item: (typeof allItems)[number] | null) =>
    item ? { href: item.href, title: item.title } : emptyItem;

  // Get previous and next items based on current index
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  return {
    prev: getItemData(prevItem),
    next: getItemData(nextItem),
  };
}
