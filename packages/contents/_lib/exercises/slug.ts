import type { ContentPagination } from "@repo/contents/_types/content";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type {
  ExercisesMaterial,
  ExercisesMaterialList,
} from "@repo/contents/_types/exercises/material";
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

/**
 * Gets the previous and next exercise materials for pagination based on the current path.
 *
 * @param currentPath - The current path/URL being viewed
 * @param materials - List of exercise materials and their items
 * @returns Object containing previous and next navigation items with empty strings if not available
 *
 * Time Complexity: O(n) where n is total number of items across all materials
 */
export function getExercisesPagination(
  currentPath: string,
  materials: ExercisesMaterialList
): ContentPagination {
  const emptyItem = { href: "", title: "" };

  const allItems = materials.flatMap((material) =>
    material.items.map((item) => ({
      ...item,
    }))
  );

  const currentIndex = allItems.findIndex((item) => item.href === currentPath);

  if (currentIndex === -1) {
    return { prev: emptyItem, next: emptyItem };
  }

  function getItemData(item: (typeof allItems)[number] | null) {
    return item ? { href: item.href, title: item.title } : emptyItem;
  }

  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  return {
    prev: getItemData(prevItem),
    next: getItemData(nextItem),
  };
}

/**
 * Gets the previous and next exercise numbers for pagination based on the current exercise number.
 *
 * @param basePath - The base path of the exercise set (without the number)
 * @param currentNumber - The current exercise number
 * @param totalExercises - Total number of exercises in the set
 * @param titleFormatter - Function to format the title for each exercise number
 * @returns Object containing previous and next navigation items with empty strings if not available
 */
export function getExerciseNumberPagination(
  basePath: string,
  currentNumber: number,
  totalExercises: number,
  titleFormatter: (number: number) => string
): ContentPagination {
  const emptyItem = { href: "", title: "" };

  const prevNumber = currentNumber > 1 ? currentNumber - 1 : null;
  const nextNumber = currentNumber < totalExercises ? currentNumber + 1 : null;

  function getNumberData(number: number | null) {
    if (!number) {
      return emptyItem;
    }
    return {
      href: `${basePath}/${number}`,
      title: titleFormatter(number),
    };
  }

  return {
    prev: getNumberData(prevNumber),
    next: getNumberData(nextNumber),
  };
}
