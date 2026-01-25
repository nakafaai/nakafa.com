import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { Locale } from "next-intl";

const TOTAL_SURAH = 114;
const EXERCISE_SET_REGEX = /^(exercises\/.*?)\/\d+\/_(?:question|answer)$/;
const EXERCISE_NUMBER_REGEX = /^(exercises\/.*?\/\d+)\/_(?:question|answer)$/;

interface StaticParamsWithLocale {
  locale: string;
  slug: string[];
}

interface StaticParamsSlugOnly {
  slug: string[];
}

interface BaseConfig {
  locales?: readonly string[];
}

interface ContentPathsConfig extends BaseConfig {
  basePath: string;
}

interface SlugOnlyConfig extends BaseConfig {
  includeQuran?: boolean;
  includeExerciseSets?: boolean;
  includeExerciseNumbers?: boolean;
  includeOGVariants?: boolean;
}

interface LocaleParamsConfig extends BaseConfig {
  includeOGVariants?: boolean;
}

/**
 * Extracts unique exercise set paths from MDX cache entries.
 * Transforms paths like "exercises/.../set-1/1/_question" to "exercises/.../set-1"
 */
export function getExerciseSetPaths(slugs: readonly string[]): string[] {
  const exerciseSets = new Set<string>();

  for (const slug of slugs) {
    const match = slug.match(EXERCISE_SET_REGEX);
    if (match?.[1]) {
      exerciseSets.add(match[1]);
    }
  }

  return Array.from(exerciseSets);
}

/**
 * Extracts unique exercise number paths from MDX cache entries.
 * Transforms paths like "exercises/.../set-1/1/_question" to "exercises/.../set-1/1"
 */
export function getExerciseNumberPaths(slugs: readonly string[]): string[] {
  const exerciseNumbers = new Set<string>();

  for (const slug of slugs) {
    const match = slug.match(EXERCISE_NUMBER_REGEX);
    if (match?.[1]) {
      exerciseNumbers.add(match[1]);
    }
  }

  return Array.from(exerciseNumbers);
}

/**
 * Gets all MDX content paths for a specific base path and locale.
 * Returns paths relative to the base path.
 */
function getMDXPathsForBasePath(locale: Locale, basePath: string): Set<string> {
  const allSlugs = getMDXSlugsForLocale(locale);
  const prefix = `${basePath}/`;

  return new Set(
    allSlugs
      .filter((slug) => slug.startsWith(prefix))
      .map((slug) => slug.slice(prefix.length))
  );
}

/**
 * Gets all folder paths under a base directory.
 */
function getAllFolderPaths(basePath: string): Set<string> {
  const topDirs = Effect.runSync(
    Effect.match(getFolderChildNames(basePath), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );

  const folderPaths = new Set<string>();

  for (const topDir of topDirs) {
    folderPaths.add(topDir);

    const nestedPaths = getNestedSlugs(`${basePath}/${topDir}`);
    for (const pathParts of nestedPaths) {
      folderPaths.add(`${topDir}/${pathParts.join("/")}`);
    }
  }

  return folderPaths;
}

/**
 * Generates static params for content pages filtered by base path.
 * Used by API routes that need locale as separate param.
 *
 * @example
 * ```ts
 * export function generateStaticParams() {
 *   return generateContentParams({ basePath: "subject" });
 * }
 * ```
 */
export function generateContentParams(
  config: ContentPathsConfig
): StaticParamsWithLocale[] {
  const { basePath, locales = routing.locales } = config;
  const result: StaticParamsWithLocale[] = [];

  const allFolderPaths = getAllFolderPaths(basePath);

  for (const locale of locales) {
    const mdxPaths = getMDXPathsForBasePath(locale as Locale, basePath);

    for (const folderPath of allFolderPaths) {
      result.push({
        locale,
        slug: folderPath.split("/"),
      });
    }

    for (const mdxPath of mdxPaths) {
      if (!allFolderPaths.has(mdxPath)) {
        result.push({
          locale,
          slug: mdxPath.split("/"),
        });
      }
    }

    if (basePath === "exercises") {
      const allSlugs = getMDXSlugsForLocale(locale as Locale);
      const exerciseSetPaths = getExerciseSetPaths(allSlugs);

      for (const exercisePath of exerciseSetPaths) {
        const relativePath = exercisePath.slice("exercises/".length);
        const slugParts = relativePath.split("/");

        const pathStr = slugParts.join("/");
        if (!allFolderPaths.has(pathStr)) {
          result.push({
            locale,
            slug: slugParts,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Generates static params with locale embedded in slug array.
 * Used by routes like /llms.mdx/[...slug] and /og/[...slug] where locale is part of the path.
 *
 * @example
 * ```ts
 * // For llms.mdx route
 * export function generateStaticParams() {
 *   return generateSlugOnlyParams({
 *     includeQuran: true,
 *     includeExerciseSets: true,
 *     includeExerciseNumbers: true,
 *   });
 * }
 *
 * // For /og route (locale in slug with image.png variants)
 * export function generateStaticParams() {
 *   return generateSlugOnlyParams({
 *     includeOGVariants: true,
 *   });
 * }
 * ```
 */
export function generateSlugOnlyParams(
  config: SlugOnlyConfig = {}
): StaticParamsSlugOnly[] {
  const {
    locales = routing.locales,
    includeQuran = false,
    includeExerciseSets = false,
    includeExerciseNumbers = false,
    includeOGVariants = false,
  } = config;

  const topDirs = Effect.runSync(
    Effect.match(getFolderChildNames("."), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );

  const result: StaticParamsSlugOnly[] = [];

  const addPath = (locale: string, slugParts: string[]) => {
    result.push({ slug: [locale, ...slugParts] });
    if (includeOGVariants && slugParts.length > 0) {
      result.push({ slug: [locale, ...slugParts, "image.png"] });
    }
  };

  for (const locale of locales) {
    if (includeOGVariants) {
      result.push({ slug: [locale, "image.png"] });
    }

    const slugs = getMDXSlugsForLocale(locale as Locale);
    const localeCache = new Set(slugs);

    for (const topDir of topDirs) {
      if (localeCache.has(topDir)) {
        addPath(locale, [topDir]);
      }

      const nestedPaths = getNestedSlugs(topDir);

      for (const pathParts of nestedPaths) {
        const fullPath = `${topDir}/${pathParts.join("/")}`;

        if (localeCache.has(fullPath)) {
          addPath(locale, [topDir, ...pathParts]);
        }
      }
    }

    if (includeExerciseSets) {
      const exerciseSetPaths = getExerciseSetPaths(slugs);
      for (const exercisePath of exerciseSetPaths) {
        addPath(locale, exercisePath.split("/"));
      }
    }

    if (includeExerciseNumbers) {
      const exerciseNumberPaths = getExerciseNumberPaths(slugs);
      for (const exercisePath of exerciseNumberPaths) {
        addPath(locale, exercisePath.split("/"));
      }
    }

    if (includeQuran) {
      addPath(locale, ["quran"]);

      for (let i = 1; i <= TOTAL_SURAH; i++) {
        addPath(locale, ["quran", i.toString()]);
      }
    }
  }

  return result;
}

/**
 * Generates static params with locale as separate param.
 * Used by routes like /[locale]/og/[...slug] where locale is a route param.
 *
 * @example
 * ```ts
 * // For /[locale]/og route
 * export function generateStaticParams() {
 *   return generateLocaleParams({
 *     includeOGVariants: true,
 *   });
 * }
 * ```
 */
export function generateLocaleParams(
  config: LocaleParamsConfig = {}
): StaticParamsWithLocale[] {
  const { locales = routing.locales, includeOGVariants = false } = config;

  const topDirs = Effect.runSync(
    Effect.match(getFolderChildNames("."), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );

  const result: StaticParamsWithLocale[] = [];

  const addPath = (locale: string, slugParts: string[]) => {
    result.push({ locale, slug: slugParts });
    if (includeOGVariants && slugParts.length > 0) {
      result.push({ locale, slug: [...slugParts, "image.png"] });
    }
  };

  for (const locale of locales) {
    if (includeOGVariants) {
      result.push({ locale, slug: ["image.png"] });
    }

    const slugs = getMDXSlugsForLocale(locale as Locale);
    const localeCache = new Set(slugs);

    for (const topDir of topDirs) {
      if (localeCache.has(topDir)) {
        addPath(locale, [topDir]);
      }

      const nestedPaths = getNestedSlugs(topDir);

      for (const pathParts of nestedPaths) {
        const fullPath = `${topDir}/${pathParts.join("/")}`;

        if (localeCache.has(fullPath)) {
          addPath(locale, [topDir, ...pathParts]);
        }
      }
    }
  }

  return result;
}
