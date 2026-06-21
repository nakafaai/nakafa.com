import type { ExercisesMaterialList } from "@repo/contents/_types/assessment/material";
import { getPracticeMaterialList } from "@repo/contents/_types/material/registry";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";

/**
 * Loads the localized material list for an exercises section.
 *
 * @param path - Exercises material path, with or without a leading slash
 * @param locale - Locale used to select localized material labels
 * @returns Parsed material list, or an empty list when unavailable
 */
export const getMaterials = Effect.fn("Contents.Exercises.getMaterials")(
  (path: string, locale: Locale) =>
    Effect.sync(() => {
      const cleanPath = cleanSlug(path.startsWith("/") ? path.slice(1) : path);

      return getPracticeMaterialList(cleanPath, locale);
    })
);

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
  const normalizedPath = cleanSlug(path);

  for (const mat of materials) {
    if (cleanSlug(mat.href) === normalizedPath) {
      return {
        currentMaterial: Option.some(mat),
        currentMaterialItem:
          Option.none<(typeof materials)[number]["items"][number]>(),
      };
    }

    for (const item of mat.items) {
      if (cleanSlug(item.href) === normalizedPath) {
        return {
          currentMaterial: Option.some(mat),
          currentMaterialItem: Option.some(item),
        };
      }
    }
  }

  return {
    currentMaterial: Option.none<(typeof materials)[number]>(),
    currentMaterialItem:
      Option.none<(typeof materials)[number]["items"][number]>(),
  };
}
