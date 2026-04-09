import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type {
  ExercisesMaterial,
  ExercisesMaterialList,
} from "@repo/contents/_types/exercises/material";
import {
  ExercisesMaterialListSchema,
  ExercisesMaterialSchema,
} from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { cleanSlug } from "@repo/utilities/helper";
import type { Locale } from "next-intl";

/**
 * Builds the public path for an exercises material page.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @param material - Exercises material slug
 * @returns Canonical material path
 */
export function getMaterialPath(
  category: ExercisesCategory,
  type: ExercisesType,
  material: ExercisesMaterial
) {
  return `/exercises/${category}/${type}/${material}` as const;
}

/**
 * Loads the localized material list for an exercises section.
 *
 * @param path - Exercises material path, with or without a leading slash
 * @param locale - Locale used to select the `_data/*-material.ts` file
 * @returns Parsed material list, or an empty list when unavailable
 */
export async function getMaterials(
  path: string,
  locale: Locale
): Promise<ExercisesMaterialList> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;

    const content = await import(
      `@repo/contents/${cleanPath}/_data/${locale}-material.ts`
    );

    const parsedContent = ExercisesMaterialListSchema.parse(content.default);

    return parsedContent;
  } catch {
    return [];
  }
}

/**
 * Finds the active material group and optional item for a route path.
 *
 * @param path - Current route path to match against material href values
 * @param materials - Localized material list for the section
 * @returns Matching material group and item when either is found
 */
export function getCurrentMaterial(
  path: string,
  materials: ExercisesMaterialList
) {
  let currentMaterial: (typeof materials)[number] | undefined;
  let currentMaterialItem:
    | (typeof materials)[number]["items"][number]
    | undefined;

  const normalizedPath = cleanSlug(path);

  for (const mat of materials) {
    if (cleanSlug(mat.href) === normalizedPath) {
      currentMaterial = mat;
      break;
    }

    const foundItem = mat.items.find(
      (itm) => cleanSlug(itm.href) === normalizedPath
    );

    if (foundItem) {
      currentMaterial = mat;
      currentMaterialItem = foundItem;
      break;
    }
  }

  return { currentMaterial, currentMaterialItem };
}

/** Narrows one exercises material route segment to the supported material union. */
export function parseExercisesMaterial(value: string) {
  const parsedMaterial = ExercisesMaterialSchema.safeParse(value);

  if (!parsedMaterial.success) {
    return null;
  }

  return parsedMaterial.data;
}
