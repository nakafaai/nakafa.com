import { getExerciseByNumber } from "@repo/contents/_lib/exercises";
import {
  getCurrentMaterial,
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getSlugPath } from "@repo/contents/_lib/exercises/slug";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import { isNumber } from "@/lib/utils/number";

/**
 * Input parameters for fetching exercise context.
 */
interface FetchExerciseContextInput {
  /** The exercise category */
  category: ExercisesCategory;
  /** The locale for localized content */
  locale: Locale;
  /** The exercise material */
  material: ExercisesMaterial;
  /** The slug path segments for the specific exercise */
  slug: string[];
  /** The exercise type */
  type: ExercisesType;
}

/**
 * Output data containing fetched exercise context.
 */
interface FetchExerciseContextOutput {
  /** The current material being accessed (guaranteed to be defined) */
  currentMaterial: NonNullable<
    ReturnType<typeof getCurrentMaterial>["currentMaterial"]
  >;
  /** The specific item within the current material (guaranteed to be defined) */
  currentMaterialItem: NonNullable<
    ReturnType<typeof getCurrentMaterial>["currentMaterialItem"]
  >;
  /** All available materials for the given category/type/material */
  materials: Awaited<ReturnType<typeof getMaterials>>;
}

/**
 * Output data containing fetched exercise metadata context.
 */
interface FetchExerciseMetadataContextOutput {
  /** The current material being accessed (can be undefined for metadata generation) */
  currentMaterial: ReturnType<typeof getCurrentMaterial>["currentMaterial"];
  /** The specific item within the current material (can be undefined for metadata generation) */
  currentMaterialItem: ReturnType<
    typeof getCurrentMaterial
  >["currentMaterialItem"];
  /** The exercise title if it's a specific exercise, undefined otherwise */
  exerciseTitle: string | undefined;
  /** The full file path to the content file */
  FilePath: ReturnType<typeof getSlugPath>;
  /** Whether this is a specific exercise page (numeric slug) */
  isSpecificExercise: boolean;
  /** All available materials for the given category/type/material */
  materials: Awaited<ReturnType<typeof getMaterials>>;
}

/**
 * Fetches the exercise context including materials, current material, and current material item.
 *
 * @param input - The input parameters for fetching exercise context
 * @param input.locale - The locale for localized content
 * @param input.category - The exercise category
 * @param input.type - The exercise type
 * @param input.material - The exercise material
 * @param input.slug - The slug path segments for the specific exercise
 * @returns An Effect that resolves to the exercise context or fails with an Error
 */
export function fetchExerciseContext({
  locale,
  category,
  type,
  material,
  slug,
}: FetchExerciseContextInput): Effect.Effect<
  FetchExerciseContextOutput,
  Error
> {
  const materialPath = getMaterialPath(category, type, material);
  const FilePath = getSlugPath(category, type, material, slug);

  return Effect.all({
    materials: Effect.tryPromise({
      try: () => getMaterials(materialPath, locale),
      catch: () => new Error("Failed to fetch materials"),
    }),
  }).pipe(
    Effect.flatMap(({ materials }) => {
      const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
        FilePath,
        materials
      );

      if (currentMaterial === undefined || currentMaterialItem === undefined) {
        return Effect.fail(new Error("Exercise material not found"));
      }

      return Effect.succeed({
        materials,
        currentMaterial,
        currentMaterialItem,
      });
    })
  );
}

/**
 * Fetches the exercise metadata context for generating page metadata.
 *
 * @param input - The input parameters for fetching exercise metadata context
 * @param input.locale - The locale for localized content
 * @param input.category - The exercise category
 * @param input.type - The exercise type
 * @param input.material - The exercise material
 * @param input.slug - The slug path segments for the specific exercise
 * @returns An Effect that resolves to the exercise metadata context or fails with an Error
 */
export function fetchExerciseMetadataContext({
  locale,
  category,
  type,
  material,
  slug,
}: FetchExerciseContextInput): Effect.Effect<
  FetchExerciseMetadataContextOutput,
  Error
> {
  return Effect.gen(function* () {
    const materialPath = getMaterialPath(category, type, material);
    const lastSlug = slug.at(-1);
    const isSpecificExercise = lastSlug && isNumber(lastSlug);

    const baseSlug = isSpecificExercise ? slug.slice(0, -1) : slug;
    const FilePath = getSlugPath(category, type, material, slug);

    const [materials, exerciseOption] = yield* Effect.all([
      Effect.tryPromise({
        try: () => getMaterials(materialPath, locale),
        catch: () => new Error("Failed to fetch materials"),
      }),
      isSpecificExercise
        ? getExerciseByNumber(
            locale,
            getSlugPath(category, type, material, baseSlug),
            Number.parseInt(lastSlug, 10)
          )
        : Effect.succeed(Option.none()),
    ]);

    const exerciseTitle = Option.isSome(exerciseOption)
      ? exerciseOption.value.question.metadata.title
      : undefined;

    const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
      FilePath,
      materials
    );

    return {
      isSpecificExercise: Boolean(isSpecificExercise),
      exerciseTitle,
      FilePath,
      materials,
      currentMaterial,
      currentMaterialItem,
    };
  });
}
