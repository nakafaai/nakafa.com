import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import {
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
  getNestedSlugs,
} from "@repo/contents/_lib/fs";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { Locale } from "next-intl";

const EXERCISE_SET_REGEX = /^(exercises\/.*?)\/\d+\/_(?:question|answer)$/;
const EXERCISE_NUMBER_REGEX = /^(exercises\/.*?\/\d+)\/_(?:question|answer)$/;

interface StaticParamsWithLocale {
  locale: Locale;
  slug: string[];
}

interface ContentPathCandidate {
  fullPath: string;
  slugParts: string[];
}

interface BaseConfig {
  locales?: readonly Locale[];
}

interface ContentPathsConfig extends BaseConfig {
  basePath: string;
}

interface LocaleParamsConfig extends BaseConfig {}

interface FolderPathCacheEntry {
  paths: Set<string>;
  version: number;
}

interface ContentPathCandidatesCacheEntry {
  candidates: ContentPathCandidate[];
  version: number;
}

const folderPathCache = new Map<string, FolderPathCacheEntry>();
let contentPathCandidatesCache: ContentPathCandidatesCacheEntry | undefined;

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
  const version = getFolderChildNamesCacheVersion();
  const cachedPaths = folderPathCache.get(basePath);

  if (cachedPaths?.version === version) {
    return cachedPaths.paths;
  }

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

  folderPathCache.set(basePath, { paths: folderPaths, version });

  return folderPaths;
}

/**
 * Collects top-level and nested content paths once so locale-specific static
 * param generation can reuse the same filesystem walk.
 *
 * This keeps locale-param generation from rescanning the same directory tree
 * for every locale.
 *
 * @returns Ordered path candidates rooted at the contents package
 */
function getContentPathCandidates(): ContentPathCandidate[] {
  const version = getFolderChildNamesCacheVersion();

  if (contentPathCandidatesCache?.version === version) {
    return contentPathCandidatesCache.candidates;
  }

  const topDirs = Effect.runSync(
    Effect.match(getFolderChildNames("."), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );

  const candidates: ContentPathCandidate[] = [];

  for (const topDir of topDirs) {
    candidates.push({
      fullPath: topDir,
      slugParts: [topDir],
    });

    const nestedPaths = getNestedSlugs(topDir);

    for (const pathParts of nestedPaths) {
      candidates.push({
        fullPath: `${topDir}/${pathParts.join("/")}`,
        slugParts: [topDir, ...pathParts],
      });
    }
  }

  contentPathCandidatesCache = { candidates, version };

  return candidates;
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
    const mdxPaths = getMDXPathsForBasePath(locale, basePath);

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
      const allSlugs = getMDXSlugsForLocale(locale);
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
 * Generates static params with locale as separate param.
 * Used by routes like /[locale]/og/[...slug] where locale is a route param.
 *
 * @example
 * ```ts
 * export function generateStaticParams() {
 *   return generateLocaleParams();
 * }
 * ```
 */
export function generateLocaleParams(
  config: LocaleParamsConfig = {}
): StaticParamsWithLocale[] {
  const { locales = routing.locales } = config;
  const contentPathCandidates = getContentPathCandidates();
  const result: StaticParamsWithLocale[] = [];

  const addPath = (locale: Locale, slugParts: string[]) => {
    result.push({ locale, slug: slugParts });
  };

  for (const locale of locales) {
    const slugs = getMDXSlugsForLocale(locale);
    const localeCache = new Set(slugs);

    for (const candidate of contentPathCandidates) {
      if (localeCache.has(candidate.fullPath)) {
        addPath(locale, candidate.slugParts);
      }
    }
  }

  return result;
}
