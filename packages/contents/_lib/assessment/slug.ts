import type { ExercisesMaterialList } from "@repo/contents/_types/assessment/material";
import type { ContentPagination } from "@repo/contents/_types/content";
import type {
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
} from "@repo/contents/_types/taxonomy";
import { cleanSlug } from "@repo/utilities/helper";
import { Option } from "effect";

const TRY_OUT_SEGMENT = "try-out";
const EXERCISE_YEAR_SEGMENT_REGEX = /^\d{4}$/;
const EXERCISE_SET_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Compares exercise set slugs with numeric suffix awareness.
 *
 * This keeps authored progressions such as `set-2` before `set-10` while
 * preserving a stable lexical fallback for non-standard set names.
 */
export function compareExerciseSetSlugs(left: string, right: string) {
  return EXERCISE_SET_COLLATOR.compare(left, right);
}

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
  _category: ExercisesCategory,
  type: ExercisesType,
  material: ExercisesMaterial,
  slug: string[]
) {
  const materialSlug = normalizePracticeMaterialSlug(slug);

  return `/material/practice/assessment/${type}/${material}/${materialSlug}` as const;
}

/**
 * Returns true when a path segment is a valid exercise year.
 *
 * The exercise content model only treats 4-digit segments as years, so the
 * try-out helpers can distinguish yearly try-out slugs from regular collection
 * names like `semester-1`.
 */
function isExerciseYearSegment(value: Option.Option<string>) {
  return Option.match(value, {
    onNone: () => false,
    onSome: (segment) => EXERCISE_YEAR_SEGMENT_REGEX.test(segment),
  });
}

/**
 * Returns true when a relative exercise slug points to a try-out collection
 * page instead of a concrete set page.
 *
 * Supported collection routes must include an explicit year segment, such as
 * `["try-out", "2026"]`.
 */
export function isTryOutCollectionSlug(slug: readonly string[]) {
  return (
    slug.length === 2 &&
    slug[0] === TRY_OUT_SEGMENT &&
    isExerciseYearSegment(Option.fromNullable(slug.at(1)))
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
  return (
    slug[0] === TRY_OUT_SEGMENT &&
    !isExerciseYearSegment(Option.fromNullable(slug.at(1)))
  );
}

/**
 * Checks whether one route segment is exactly a positive exercise number.
 */
export function isExerciseNumberSegment(value: string) {
  const trimmedValue = value.trim();
  const numericSegment = trimmedValue.startsWith("question-")
    ? trimmedValue.slice("question-".length)
    : trimmedValue;

  if (numericSegment === "") {
    return false;
  }

  const number = Number.parseInt(numericSegment, 10);

  return number > 0 && number.toString() === numericSegment;
}

/**
 * Splits an exercise content route into the concrete set path and optional
 * exercise number.
 *
 * @see https://effect.website/docs/data-types/option/
 */
export function getExerciseSetTarget(filePath: string) {
  const segments = cleanSlug(filePath).split("/").filter(Boolean);
  const lastSegment = Option.fromNullable(segments.at(-1));

  if (
    Option.isNone(lastSegment) ||
    !isExerciseNumberSegment(lastSegment.value)
  ) {
    return {
      exerciseNumber: Option.none(),
      filePath: segments.join("/"),
    };
  }

  const rawExerciseNumber = lastSegment.value.startsWith("question-")
    ? lastSegment.value.slice("question-".length)
    : lastSegment.value;
  const exerciseNumber = Number.parseInt(rawExerciseNumber, 10);

  return {
    exerciseNumber: Option.some(exerciseNumber),
    filePath: segments.slice(0, -1).join("/"),
  };
}

function normalizePracticeMaterialSlug(slug: readonly string[]) {
  if (
    slug[0] === TRY_OUT_SEGMENT &&
    isExerciseYearSegment(Option.fromNullable(slug.at(1)))
  ) {
    return [`try-out-${slug[1]}`, ...slug.slice(2)].join("/");
  }

  return slug.join("/");
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

  const prevNumber =
    currentNumber > 1 ? Option.some(currentNumber - 1) : Option.none<number>();
  const nextNumber =
    currentNumber < totalExercises
      ? Option.some(currentNumber + 1)
      : Option.none<number>();

  function getNumberData(number: Option.Option<number>) {
    if (Option.isNone(number)) {
      return emptyItem;
    }

    return {
      href: `${basePath}/${number.value}`,
      title: titleFormatter(number.value),
    };
  }

  return {
    prev: getNumberData(prevNumber),
    next: getNumberData(nextNumber),
  };
}
