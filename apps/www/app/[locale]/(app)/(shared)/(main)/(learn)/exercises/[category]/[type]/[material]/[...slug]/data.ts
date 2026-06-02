import { getExerciseCount } from "@repo/contents/_lib/exercises/collection";
import {
  getCurrentMaterial,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import {
  getRenderableExerciseByNumber,
  getRenderableExercisesContent,
} from "@repo/contents/_lib/exercises/renderable";
import {
  getMaterialPath,
  parseExercisesCategory,
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/exercises/route";
import {
  getSlugPath,
  isTryOutCollectionSlug,
} from "@repo/contents/_lib/exercises/slug";
import { Effect, Option } from "effect";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { isNumber } from "@/lib/utils/number";

type ResolvedParams = Awaited<ReturnType<typeof getResolvedParams>>;

/** Validates and normalizes one exercises route parameter object. */
export async function getResolvedParams(
  params: PageProps<"/[locale]/exercises/[category]/[type]/[material]/[...slug]">["params"]
) {
  const {
    locale: rawLocale,
    category: rawCategory,
    type: rawType,
    material: rawMaterial,
    slug,
  } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const parsedCategory = parseExercisesCategory(rawCategory);
  const parsedType = parseExercisesType(rawType);
  const parsedMaterial = parseExercisesMaterial(rawMaterial);

  if (
    Option.isNone(parsedCategory) ||
    Option.isNone(parsedType) ||
    Option.isNone(parsedMaterial)
  ) {
    notFound();
  }

  const category = parsedCategory.value;
  const type = parsedType.value;
  const material = parsedMaterial.value;

  return { category, locale, material, slug, type };
}

/**
 * Resolves the learn-exercises route into one explicit page variant.
 *
 * The cache key uses primitive inputs only, so the same route state can be
 * reused across page rendering and `generateMetadata` within one request.
 */
export async function getExerciseRouteData(
  locale: ResolvedParams["locale"],
  category: ResolvedParams["category"],
  type: ResolvedParams["type"],
  material: ResolvedParams["material"],
  slugKey: string
) {
  "use cache";

  cacheLife("max");

  const slug = slugKey === "" ? [] : slugKey.split("/");
  const pagePath = getSlugPath(category, type, material, slug);
  const materialPath = getMaterialPath(category, type, material);
  const lastSlug = slug.at(-1);
  const isSpecificExercise =
    lastSlug !== undefined &&
    isNumber(lastSlug) &&
    !isTryOutCollectionSlug(slug);

  if (isSpecificExercise) {
    const exerciseNumber = Number.parseInt(lastSlug, 10);
    const baseSlug = slug.slice(0, -1);
    const setPath = getSlugPath(category, type, material, baseSlug);

    const [materials, exercise, exerciseCount] = await Promise.all([
      Effect.runPromise(getMaterials(materialPath, locale)),
      Effect.runPromise(
        getRenderableExerciseByNumber(locale, setPath, exerciseNumber)
      ),
      Effect.runPromise(
        Effect.match(getExerciseCount(setPath), {
          onFailure: () => 0,
          onSuccess: (count) => count,
        })
      ),
    ]);

    const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
      setPath,
      materials
    );

    if (
      Option.isNone(exercise) ||
      Option.isNone(currentMaterial) ||
      Option.isNone(currentMaterialItem)
    ) {
      return {
        kind: "missing" as const,
        materialPath,
        pagePath,
      };
    }

    return {
      kind: "single" as const,
      currentMaterial: currentMaterial.value,
      currentMaterialItem: currentMaterialItem.value,
      exercise: exercise.value,
      exerciseCount,
      exerciseFilePath: pagePath,
      materialPath,
      pagePath,
      setPath,
    };
  }

  const materials = await Effect.runPromise(getMaterials(materialPath, locale));
  const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
    pagePath,
    materials
  );

  if (Option.isSome(currentMaterial) && Option.isNone(currentMaterialItem)) {
    return {
      kind: "year-group" as const,
      currentMaterial: currentMaterial.value,
      materialPath,
      pagePath,
    };
  }

  if (Option.isNone(currentMaterial) || Option.isNone(currentMaterialItem)) {
    return {
      kind: "missing" as const,
      materialPath,
      pagePath,
    };
  }

  const exercises = await Effect.runPromise(
    getRenderableExercisesContent(locale, pagePath)
  );

  if (exercises.length === 0) {
    return {
      kind: "missing" as const,
      materialPath,
      pagePath,
    };
  }

  return {
    kind: "set" as const,
    currentMaterial: currentMaterial.value,
    currentMaterialItem: currentMaterialItem.value,
    exercises,
    materialPath,
    materials,
    pagePath,
  };
}

export type ExerciseRouteData = Awaited<
  ReturnType<typeof getExerciseRouteData>
>;
