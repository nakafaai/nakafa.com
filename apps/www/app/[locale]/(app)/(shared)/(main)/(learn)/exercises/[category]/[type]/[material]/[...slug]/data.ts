import { parseExercisesCategory } from "@repo/contents/_lib/exercises/category";
import { getExerciseCount } from "@repo/contents/_lib/exercises/collection";
import {
  getCurrentMaterial,
  getMaterialPath,
  getMaterials,
  parseExercisesMaterial,
} from "@repo/contents/_lib/exercises/material";
import {
  getRenderableExerciseByNumber,
  getRenderableExercisesContent,
} from "@repo/contents/_lib/exercises/renderable";
import {
  getSlugPath,
  isTryOutCollectionSlug,
} from "@repo/contents/_lib/exercises/slug";
import { parseExercisesType } from "@repo/contents/_lib/exercises/type";
import { Effect } from "effect";
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
  const category = parseExercisesCategory(rawCategory);
  const type = parseExercisesType(rawType);
  const material = parseExercisesMaterial(rawMaterial);

  if (!(category && type && material)) {
    notFound();
  }

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
      getMaterials(materialPath, locale),
      getRenderableExerciseByNumber(locale, setPath, exerciseNumber),
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

    if (!(exercise && currentMaterial && currentMaterialItem)) {
      return {
        kind: "missing" as const,
        currentMaterial,
        currentMaterialItem,
        materialPath,
        pagePath,
      };
    }

    return {
      kind: "single" as const,
      currentMaterial,
      currentMaterialItem,
      exercise,
      exerciseCount,
      exerciseFilePath: pagePath,
      materialPath,
      pagePath,
      setPath,
    };
  }

  const materials = await getMaterials(materialPath, locale);
  const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
    pagePath,
    materials
  );

  if (currentMaterial && !currentMaterialItem) {
    return {
      kind: "year-group" as const,
      currentMaterial,
      currentMaterialItem,
      materialPath,
      pagePath,
    };
  }

  if (!(currentMaterial && currentMaterialItem)) {
    return {
      kind: "missing" as const,
      currentMaterial,
      currentMaterialItem,
      materialPath,
      pagePath,
    };
  }

  const exercises = await getRenderableExercisesContent(locale, pagePath);

  if (exercises.length === 0) {
    return {
      kind: "missing" as const,
      currentMaterial,
      currentMaterialItem,
      materialPath,
      pagePath,
    };
  }

  return {
    kind: "set" as const,
    currentMaterial,
    currentMaterialItem,
    exercises,
    materialPath,
    materials,
    pagePath,
  };
}

export type ExerciseRouteData = Awaited<
  ReturnType<typeof getExerciseRouteData>
>;
