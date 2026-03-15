import type { ContentPagination } from "@repo/contents/_types/content";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type {
  ExercisesMaterial,
  ExercisesMaterialList,
} from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";

const TRY_OUT_SEGMENT = "try-out";
const EXERCISE_YEAR_SEGMENT_REGEX = /^\d{4}$/;

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
 * Returns true when a path segment is a valid exercise year.
 *
 * The exercise content model only treats 4-digit segments as years, so the
 * try-out helpers can distinguish yearly try-out slugs from regular collection
 * names like `semester-1`.
 */
function isExerciseYearSegment(value: string | undefined) {
  return value !== undefined && EXERCISE_YEAR_SEGMENT_REGEX.test(value);
}

/**
 * Returns true when a relative exercise slug points to the old yearless
 * try-out collection root.
 *
 * Expected input is relative to the material path, not a full URL path.
 * For example:
 * - `["try-out"]`
 * - `["try-out", "2026"]`
 * - `["semester-1", "set-1"]`
 */
export function isYearlessTryOutCollectionSlug(slug: readonly string[]) {
  return slug.length === 1 && slug[0] === TRY_OUT_SEGMENT;
}

/**
 * Returns true when a relative exercise slug points to a try-out collection
 * page instead of a concrete set page.
 *
 * Supported collection shapes are:
 * - `["try-out"]` for the legacy yearless root
 * - `["try-out", "2026"]` for the yearly root
 */
export function isTryOutCollectionSlug(slug: readonly string[]) {
  return (
    isYearlessTryOutCollectionSlug(slug) ||
    (slug.length === 2 &&
      slug[0] === TRY_OUT_SEGMENT &&
      isExerciseYearSegment(slug[1]))
  );
}

/**
 * Returns true when a try-out slug starts with `try-out` but does not include
 * a valid 4-digit year as the next segment.
 *
 * Examples:
 * - `["try-out"]` => true
 * - `["try-out", "set-1"]` => true
 * - `["try-out", "2026"]` => false
 */
export function hasInvalidTryOutYearSlug(slug: readonly string[]) {
  return slug[0] === TRY_OUT_SEGMENT && !isExerciseYearSegment(slug[1]);
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
