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
import { notFound } from "next/navigation";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  getCurrentExerciseMaterial,
  getRuntimeExerciseMaterials,
} from "@/lib/content/navigation";
import {
  fetchRuntimeExerciseGroupPage,
  fetchRuntimeExerciseQuestionPage,
  fetchRuntimeExerciseSetPage,
} from "@/lib/content/runtime";
import { getContentRuntimeSlug } from "@/lib/content/slug";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { isNumber } from "@/lib/utils/number";

type ResolvedParams = Awaited<ReturnType<typeof getResolvedParams>>;

const YEAR_SEGMENT = /^\d{4}$/;

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

  applyContentRuntimeCache();

  const slug = slugKey === "" ? [] : slugKey.split("/");
  const pagePath = getSlugPath(category, type, material, slug);
  const materialPath = getMaterialPath(category, type, material);
  const lastSlug = slug.at(-1);
  const isSpecificExercise =
    lastSlug !== undefined &&
    isNumber(lastSlug) &&
    !isTryOutCollectionSlug(slug);

  if (isSpecificExercise) {
    const baseSlug = slug.slice(0, -1);
    const setPath = getSlugPath(category, type, material, baseSlug);
    const runtimeSlug = getContentRuntimeSlug(pagePath);

    const [materials, questionPage] = await Promise.all([
      Effect.runPromise(getRuntimeExerciseMaterials(materialPath, locale)),
      fetchRuntimeExerciseQuestionPage({
        locale,
        slug: runtimeSlug,
      }),
    ]);

    if (!questionPage) {
      return {
        kind: "missing" as const,
        materialPath,
        pagePath,
      };
    }

    const { currentMaterial, currentMaterialItem } = getCurrentExerciseMaterial(
      setPath,
      materials
    );

    if (Option.isNone(currentMaterial) || Option.isNone(currentMaterialItem)) {
      throw new Error(
        `Synced exercise question is missing material navigation: ${pagePath}`
      );
    }

    return {
      kind: "single" as const,
      currentMaterial: currentMaterial.value,
      currentMaterialItem: currentMaterialItem.value,
      exercise: questionPage.exercise,
      exerciseCount: questionPage.exerciseCount,
      exerciseFilePath: pagePath,
      materialPath,
      pagePath,
      setPath,
    };
  }

  const materials = await Effect.runPromise(
    getRuntimeExerciseMaterials(materialPath, locale)
  );
  const runtimeSlug = getContentRuntimeSlug(pagePath);
  const setPage = await fetchRuntimeExerciseSetPage({
    locale,
    slug: runtimeSlug,
  });
  const { currentMaterial, currentMaterialItem } = getCurrentExerciseMaterial(
    pagePath,
    materials
  );

  if (setPage) {
    if (Option.isNone(currentMaterial) || Option.isNone(currentMaterialItem)) {
      throw new Error(
        `Synced exercise set is missing material navigation: ${pagePath}`
      );
    }

    return {
      kind: "set" as const,
      currentMaterial: currentMaterial.value,
      currentMaterialItem: currentMaterialItem.value,
      exercises: setPage.exercises,
      materialPath,
      materials,
      pagePath,
    };
  }

  const groupParams = getExerciseGroupParams(slug);
  const groupPage = groupParams
    ? await fetchRuntimeExerciseGroupPage({
        category,
        exerciseType: groupParams.exerciseType,
        locale,
        material,
        type,
        year: groupParams.year,
      })
    : null;

  if (groupPage) {
    if (Option.isNone(currentMaterial) || Option.isSome(currentMaterialItem)) {
      throw new Error(
        `Synced exercise group is missing material navigation: ${pagePath}`
      );
    }

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

  return {
    kind: "missing" as const,
    materialPath,
    pagePath,
  };
}

export type ExerciseRouteData = Awaited<
  ReturnType<typeof getExerciseRouteData>
>;

/** Parses exercise group route slugs such as `try-out` or `try-out/2026`. */
function getExerciseGroupParams(slug: string[]) {
  const exerciseType = slug.at(0);

  if (!exerciseType || slug.length > 2) {
    return null;
  }

  const year = slug.at(1);

  if (!year) {
    return { exerciseType };
  }

  if (!YEAR_SEGMENT.test(year)) {
    return null;
  }

  return { exerciseType, year };
}
