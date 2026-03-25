import type { ContentPagination } from "@repo/contents/_types/content";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type {
  Material,
  MaterialList,
} from "@repo/contents/_types/subject/material";

/**
 * Builds the public path for a nested subject content page.
 *
 * @param category - Subject category slug
 * @param grade - Grade slug within the category
 * @param material - Material slug within the grade
 * @param slug - Remaining nested content segments under the material
 * @returns Canonical content path for the subject route
 */
export function getSlugPath(
  category: SubjectCategory,
  grade: Grade,
  material: Material,
  slug: string[]
) {
  return `/subject/${category}/${grade}/${material}/${slug.join("/")}` as const;
}

/**
 * Builds pagination links between subject material items.
 *
 * @param currentPath - Current route path being viewed
 * @param materials - Subject material groups and items in display order
 * @returns Previous and next navigation targets, or empty items when missing
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
  function getItemData(item: (typeof allItems)[number] | null) {
    return item ? { href: item.href, title: item.title } : emptyItem;
  }
  // Get previous and next items based on current index
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  return {
    prev: getItemData(prevItem),
    next: getItemData(nextItem),
  };
}
