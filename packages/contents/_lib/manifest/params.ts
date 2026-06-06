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
  localeSlugs: readonly LocaleSlugEntry[],
  candidates: readonly ContentPathCandidate[]
) {
  return {
    articles: getStaticParamsForRoot(
      localeSlugs,
      candidates,
      CONTENT_ROOT_VALUES.articles
    ),
    exercises: getStaticParamsForRoot(
      localeSlugs,
      candidates,
      CONTENT_ROOT_VALUES.exercises
    ),
    subject: getStaticParamsForRoot(
      localeSlugs,
      candidates,
      CONTENT_ROOT_VALUES.subject
    ),
  };
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
  localeSlugs: readonly LocaleSlugEntry[],
  candidates: readonly ContentPathCandidate[],
  root: ContentRoot
) {
  const folderPaths = getFolderPathsForRoot(candidates, root);
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
}

/** Returns content-root-relative folder paths from the shared route candidates. */
function getFolderPathsForRoot(
  candidates: readonly ContentPathCandidate[],
  root: ContentRoot
) {
  const paths = new Set<string>();

  for (const candidate of candidates) {
    const [candidateRoot, ...pathParts] = candidate.slugParts;

    if (candidateRoot !== root || pathParts.length === 0) {
      continue;
    }

    paths.add(pathParts.join("/"));
  }

  return paths;
}

/** Returns MDX paths below one content root without the root segment. */
function getMdxPathsForRoot(slugs: readonly string[], root: ContentRoot) {
  const prefix = `${root}/`;

  return new Set(
    slugs.flatMap((slug) => {
      if (!slug.startsWith(prefix)) {
        return [];
      }

      return [slug.slice(prefix.length)];
    })
  );
}
