import {
  getExerciseNumberPaths,
  getExerciseSetPaths,
} from "@repo/contents/_lib/manifest/exercise-paths";
import type {
  ContentManifestStaticParam,
  ContentPathCandidate,
  LocaleSlugEntry,
} from "@repo/contents/_lib/manifest/schema";
import {
  type ContentRouteSource,
  getFolderNamesOrEmpty,
} from "@repo/contents/_lib/manifest/source";
import {
  CONTENT_ROOT_VALUES,
  type ContentRoot,
} from "@repo/contents/_types/content";
import { Effect } from "effect";

/** Filters manifest params to the requested locale set. */
export function filterParamsByLocales(
  params: readonly ContentManifestStaticParam[],
  locales: readonly string[]
) {
  const localeSet = new Set(locales);

  return params.filter((param) => localeSet.has(param.locale));
}

/** Reads all MDX slugs for every requested locale once. */
export function getLocaleSlugs(
  source: ContentRouteSource,
  locales: readonly string[]
) {
  return Effect.gen(function* () {
    const entries: LocaleSlugEntry[] = [];

    for (const locale of locales) {
      entries.push({
        locale,
        slugs: yield* source.getMdxSlugs(locale),
      });
    }

    return entries;
  });
}

/** Returns every folder path under one content root. */
export function getFolderPaths(
  source: ContentRouteSource,
  basePath: ContentRoot
) {
  return Effect.gen(function* () {
    const topDirs = yield* getFolderNamesOrEmpty(source, basePath);
    const paths = new Set<string>();

    for (const topDir of topDirs) {
      paths.add(topDir);

      const nestedPaths = yield* source.getNestedSlugParts(
        `${basePath}/${topDir}`
      );

      for (const pathParts of nestedPaths) {
        paths.add(`${topDir}/${pathParts.join("/")}`);
      }
    }

    return paths;
  });
}

/** Returns all route candidates rooted at the content package. */
export function getContentPathCandidates(source: ContentRouteSource) {
  return Effect.gen(function* () {
    const topDirs = yield* getFolderNamesOrEmpty(source, ".");
    const candidates: ContentPathCandidate[] = [];

    for (const topDir of topDirs) {
      candidates.push({
        fullPath: topDir,
        slugParts: [topDir],
      });

      const nestedPaths = yield* source.getNestedSlugParts(topDir);

      for (const pathParts of nestedPaths) {
        candidates.push({
          fullPath: `${topDir}/${pathParts.join("/")}`,
          slugParts: [topDir, ...pathParts],
        });
      }
    }

    return candidates;
  });
}

/** Builds every broad static-param group from one manifest source scan. */
export function getStaticParams(
  source: ContentRouteSource,
  localeSlugs: readonly LocaleSlugEntry[]
) {
  return Effect.gen(function* () {
    return {
      articles: yield* getStaticParamsForRoot(
        source,
        localeSlugs,
        CONTENT_ROOT_VALUES.articles
      ),
      exercises: yield* getStaticParamsForRoot(
        source,
        localeSlugs,
        CONTENT_ROOT_VALUES.exercises
      ),
      subject: yield* getStaticParamsForRoot(
        source,
        localeSlugs,
        CONTENT_ROOT_VALUES.subject
      ),
    };
  });
}

/** Builds static params for locale-aware catch-all routes. */
export function getLocaleParams(
  localeSlugs: readonly LocaleSlugEntry[],
  candidates: readonly ContentPathCandidate[]
) {
  const result: ContentManifestStaticParam[] = [];

  for (const { locale, slugs } of localeSlugs) {
    const localeCache = new Set(slugs);

    for (const candidate of candidates) {
      if (localeCache.has(candidate.fullPath)) {
        result.push({ locale, slug: candidate.slugParts });
      }
    }
  }

  return result;
}

/** Builds concrete exercise API params from set and exercise-number paths. */
export function getExerciseApiParams(localeSlugs: readonly LocaleSlugEntry[]) {
  const result: ContentManifestStaticParam[] = [];

  for (const { locale, slugs } of localeSlugs) {
    const exercisePaths = [
      ...getExerciseSetPaths(slugs),
      ...getExerciseNumberPaths(slugs),
    ];

    for (const exercisePath of exercisePaths) {
      result.push({
        locale,
        slug: exercisePath.slice("exercises/".length).split("/"),
      });
    }
  }

  return result;
}

/** Builds broad static params for one content root. */
function getStaticParamsForRoot(
  source: ContentRouteSource,
  localeSlugs: readonly LocaleSlugEntry[],
  root: ContentRoot
) {
  return Effect.gen(function* () {
    const folderPaths = yield* getFolderPaths(source, root);
    const result: ContentManifestStaticParam[] = [];

    for (const { locale, slugs } of localeSlugs) {
      const mdxPaths = getMdxPathsForRoot(slugs, root);

      for (const folderPath of folderPaths) {
        result.push({
          locale,
          slug: folderPath.split("/"),
        });
      }

      for (const mdxPath of mdxPaths) {
        if (!folderPaths.has(mdxPath)) {
          result.push({
            locale,
            slug: mdxPath.split("/"),
          });
        }
      }

      if (root !== CONTENT_ROOT_VALUES.exercises) {
        continue;
      }

      for (const exercisePath of getExerciseSetPaths(slugs)) {
        const relativePath = exercisePath.slice("exercises/".length);
        if (!folderPaths.has(relativePath)) {
          result.push({
            locale,
            slug: relativePath.split("/"),
          });
        }
      }
    }

    return result;
  });
}

/** Returns MDX paths below one content root without the root segment. */
function getMdxPathsForRoot(slugs: readonly string[], root: ContentRoot) {
  const prefix = `${root}/`;

  return new Set(
    slugs
      .filter((slug) => slug.startsWith(prefix))
      .map((slug) => slug.slice(prefix.length))
  );
}
