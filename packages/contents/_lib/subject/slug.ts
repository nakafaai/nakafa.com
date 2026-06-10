import type { ContentPagination } from "@repo/contents/_types/content";
import type { MaterialList } from "@repo/contents/_types/subject/material";
import type {
  Grade,
  Material,
  SubjectCategory,
} from "@repo/contents/_types/taxonomy";
import { Option } from "effect";

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
  const emptyItem = { href: "", title: "" };

  const allItems = materials.flatMap((subject) =>
    subject.items.map((item) => ({
      ...item,
    }))
  );

  const currentIndex = allItems.findIndex((item) => item.href === currentPath);

  if (currentIndex === -1) {
    return { prev: emptyItem, next: emptyItem };
  }

  function getItemData(item: Option.Option<(typeof allItems)[number]>) {
    if (Option.isNone(item)) {
      return emptyItem;
    }

    return { href: item.value.href, title: item.value.title };
  }

  const prevItem =
    currentIndex > 0
      ? Option.some(allItems[currentIndex - 1])
      : Option.none<(typeof allItems)[number]>();
  const nextItem =
    currentIndex < allItems.length - 1
      ? Option.some(allItems[currentIndex + 1])
      : Option.none<(typeof allItems)[number]>();

  return {
    prev: getItemData(prevItem),
    next: getItemData(nextItem),
  };
}
