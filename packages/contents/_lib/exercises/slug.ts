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
 * Legacy yearless try-out URLs were migrated into the 2026 content tree.
 *
 * This is only used to redirect old URLs that were indexed before the year was
 * added to the path. New try-out URLs must always include an explicit year.
 */
export const LEGACY_YEARLESS_TRY_OUT_REDIRECT_YEAR = "2026";

/**
 * Builds the public path for a nested exercises content page.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @param material - Exercises material slug
 * @param slug - Remaining nested content segments under the material
 * @returns Canonical content path for the exercise route
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
 * Builds pagination links between exercise collection items.
 *
 * @param currentPath - Current route path being viewed
 * @param materials - Exercises material groups and items in display order
 * @returns Previous and next navigation targets, or empty items when missing
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
 * Builds pagination links between numbered exercises in the same set.
 *
 * @param basePath - Exercise set path without the trailing question number
 * @param currentNumber - Current exercise number in the set
 * @param totalExercises - Total number of exercises in the set
 * @param titleFormatter - Formatter used for navigation item titles
 * @returns Previous and next navigation targets, or empty items when missing
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
