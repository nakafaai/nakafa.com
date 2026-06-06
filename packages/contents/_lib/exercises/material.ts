import {
  MetadataParseError,
  ModuleLoadError,
} from "@repo/contents/_shared/error";
import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { ExercisesMaterialListSchema } from "@repo/contents/_types/exercises/material";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "next-intl";

/**
 * Loads the localized material list for an exercises section.
 *
 * @param path - Exercises material path, with or without a leading slash
 * @param locale - Locale used to select the `_data/*-material.ts` file
 * @returns Parsed material list, or an empty list when unavailable
 */
export const getMaterials = Effect.fn("Contents.Exercises.getMaterials")(
  function* (path: string, locale: Locale) {
    const cleanPath = cleanSlug(path.startsWith("/") ? path.slice(1) : path);
    const modulePath = `@repo/contents/${cleanPath}/_data/${locale}-material.ts`;

    return yield* Effect.gen(function* () {
      const content = yield* Effect.tryPromise({
        try: () => import(modulePath),
        catch: (cause) =>
          new ModuleLoadError({
            cause,
            message: "Unable to import exercises material list.",
            path: modulePath,
          }),
      });

      return yield* Effect.try({
        try: () =>
          Schema.decodeUnknownSync(ExercisesMaterialListSchema)(
            content.default
          ),
        catch: (cause) =>
          new MetadataParseError({
            message: "Unable to parse exercises material list.",
            path: modulePath,
            reason: String(cause),
          }),
      });
    }).pipe(
      Effect.catchTags({
        MetadataParseError: () => Effect.succeed([]),
        ModuleLoadError: () => Effect.succeed([]),
      })
    );
  }
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
