import {
  getCurrentMaterial,
  getMaterials as getExerciseMaterials,
} from "@repo/contents/_lib/exercises/material";
import { type Locale, LocaleSchema } from "@repo/contents/_types/content";
import { Cache, Duration, Effect, Option, Schema } from "effect";

const materialRootSegmentCount = 4;
const materialCacheCapacity = 256;
const materialCacheKeySeparator = "\0";

const exerciseMaterialListCache = Effect.runSync(
  Cache.make({
    capacity: materialCacheCapacity,
    timeToLive: Duration.infinity,
    lookup: (cacheKey: string) => {
      const { locale, materialPath } = getExerciseMaterialCacheParts(cacheKey);

      return getExerciseMaterials(materialPath, locale);
    },
  })
);

/** Clears memoized Pagefind material lookups for tests and repeated script runs. */
export function clearPagefindMaterialCache() {
  return Effect.runSync(exerciseMaterialListCache.invalidateAll);
}

/** Resolves the searchable title for one exercise set route. */
export const getPagefindExerciseMaterialContext = Effect.fn(
  "Pagefind.getExerciseMaterialContext"
)(function* ({ locale, setPath }: { locale: Locale; setPath: string }) {
  const materialPath = getExerciseMaterialRootPath(setPath);
  const cacheKey = getExerciseMaterialCacheKey({ locale, materialPath });
  const materials = yield* exerciseMaterialListCache.get(cacheKey);
  const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
    `/${setPath}`,
    materials
  );
  const title =
    currentMaterialItem?.title ??
    currentMaterial?.title ??
    getExerciseSetFallbackTitle(setPath);

  if (!title) {
    return Option.none();
  }

  return Option.some({ title });
});

/** Builds the material-list root path for an exercise set route. */
export function getExerciseMaterialRootPath(setPath: string) {
  const segments = setPath.split("/");

  return `/${segments.slice(0, materialRootSegmentCount).join("/")}`;
}

/** Uses the final exercise set path segment when material metadata is absent. */
export function getExerciseSetFallbackTitle(setPath: string) {
  return setPath.split("/").at(-1);
}

/** Builds a stable native Effect Cache key for material list lookup. */
function getExerciseMaterialCacheKey({
  locale,
  materialPath,
}: {
  locale: Locale;
  materialPath: string;
}) {
  return [locale, materialPath].join(materialCacheKeySeparator);
}

/** Reads a material lookup key back into typed lookup parameters. */
function getExerciseMaterialCacheParts(cacheKey: string) {
  const [rawLocale, materialPath] = cacheKey.split(materialCacheKeySeparator);
  const locale = Schema.decodeUnknownSync(LocaleSchema)(rawLocale);

  return { locale, materialPath };
}
