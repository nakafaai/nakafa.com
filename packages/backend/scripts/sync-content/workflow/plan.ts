import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import type { ContentRouteArtifactTarget } from "@repo/backend/scripts/sync-content/routes/artifacts";
import { locales } from "@repo/utilities/locales";

/** Content row sync phases that must finish before route artifacts are rebuilt. */
export type IncrementalSyncRowPhase = "articles" | "curriculum" | "tryouts";

/**
 * Ordered work plan for one incremental sync pass.
 *
 * Row phases repair persisted content rows such as `contentRoutes` and
 * `contentSearch`; route artifacts and public routes are derived from
 * those rows and therefore run after the planned row phases.
 */
export interface IncrementalSyncPlan {
  readonly refreshPublicRoutes: boolean;
  readonly refreshQuran: boolean;
  readonly routeArtifactTargets: readonly ContentRouteArtifactTarget[];
  readonly rowPhases: readonly IncrementalSyncRowPhase[];
}

/**
 * Builds the ordered incremental sync plan from changed repository paths.
 *
 * Projection modules are part of the persisted content-row contract: route and
 * graph changes can alter `contentRoutes`, `contentSearch`, and source-owned
 * public route rows even when no MDX file changed. Keeping that invalidation
 * rule here gives the workflow one stable plan to execute.
 */
export function readIncrementalSyncPlan(
  changedFiles: readonly string[]
): IncrementalSyncPlan {
  const sourcePaths = changedFiles.map(readContentRepositoryPath);
  const hasGraphProjectionChanges = sourcePaths.some(isGraphProjectionPath);
  const hasRouteProjectionChanges = sourcePaths.some(isRouteProjectionPath);
  const hasContentProjectionChanges =
    hasGraphProjectionChanges || hasRouteProjectionChanges;
  const hasSharedContentContractChanges = sourcePaths.some(
    isSharedContentContractPath
  );
  const hasSharedDateChanges = sourcePaths.some(isSharedDatePath);
  const hasArticleTeamChanges = sourcePaths.some(isArticleTeamSourcePath);
  const hasMaterialRegistryChanges = sourcePaths.some(isMaterialRegistryPath);
  const hasProgramCatalogChanges = sourcePaths.some(isProgramCatalogPath);
  const articleSourcePaths = sourcePaths.filter(isArticleSourcePath);
  const materialSourcePaths = sourcePaths.filter(
    (file) => isMaterialSourcePath(file) || isCurriculumSourcePath(file)
  );
  const tryoutSourcePaths = sourcePaths.filter(isTryoutSourcePath);
  const quranSourcePaths = sourcePaths.filter(isQuranSourcePath);
  const articleRowsChanged =
    hasGraphProjectionChanges ||
    hasSharedContentContractChanges ||
    hasSharedDateChanges ||
    hasArticleTeamChanges ||
    articleSourcePaths.length > 0;
  const curriculumRowsChanged =
    hasContentProjectionChanges ||
    hasSharedContentContractChanges ||
    hasSharedDateChanges ||
    hasMaterialRegistryChanges ||
    hasProgramCatalogChanges ||
    materialSourcePaths.length > 0;
  const tryoutRowsChanged =
    hasContentProjectionChanges ||
    hasSharedContentContractChanges ||
    hasMaterialRegistryChanges ||
    hasProgramCatalogChanges ||
    tryoutSourcePaths.length > 0;
  const quranRowsChanged =
    hasGraphProjectionChanges ||
    hasSharedContentContractChanges ||
    quranSourcePaths.length > 0;
  const rowPhases: IncrementalSyncRowPhase[] = [];

  if (articleRowsChanged) {
    rowPhases.push("articles");
  }
  if (curriculumRowsChanged) {
    rowPhases.push("curriculum");
  }
  if (tryoutRowsChanged) {
    rowPhases.push("tryouts");
  }

  const refreshPublicRoutes =
    articleRowsChanged || curriculumRowsChanged || tryoutRowsChanged;
  const routeArtifactTargets = [
    ...readRouteArtifactTargets(
      "articles",
      articleSourcePaths,
      hasGraphProjectionChanges ||
        hasSharedContentContractChanges ||
        hasSharedDateChanges ||
        hasArticleTeamChanges
    ),
    ...readRouteArtifactTargets(
      "material",
      materialSourcePaths,
      hasContentProjectionChanges ||
        hasSharedContentContractChanges ||
        hasSharedDateChanges ||
        hasMaterialRegistryChanges ||
        hasProgramCatalogChanges
    ),
    ...readRouteArtifactTargets(
      "tryout",
      tryoutSourcePaths,
      hasContentProjectionChanges ||
        hasSharedContentContractChanges ||
        hasMaterialRegistryChanges ||
        hasProgramCatalogChanges
    ),
    ...readRouteArtifactTargets(
      "quran",
      quranSourcePaths,
      hasGraphProjectionChanges || hasSharedContentContractChanges
    ),
  ];

  return {
    refreshPublicRoutes,
    refreshQuran: quranRowsChanged,
    routeArtifactTargets,
    rowPhases,
  };
}

/** Resolves exact locale and section targets for one changed source family. */
function readRouteArtifactTargets(
  section: NakafaSection,
  sourcePaths: readonly string[],
  affectsEveryLocale: boolean
): ContentRouteArtifactTarget[] {
  if (affectsEveryLocale) {
    return locales.map((locale) => ({ locale, section }));
  }

  if (sourcePaths.length === 0) {
    return [];
  }

  const affectedLocales = readAffectedLocales(sourcePaths);

  return affectedLocales.map((locale) => ({ locale, section }));
}

/** Reads locale suffixes, falling back to every locale for shared source files. */
function readAffectedLocales(sourcePaths: readonly string[]) {
  const sourceLocales = sourcePaths.map(readSourceLocale);

  if (sourceLocales.some((locale) => locale === undefined)) {
    return locales;
  }

  return locales.filter((locale) => sourceLocales.includes(locale));
}

/** Reads a locale from either `id.mdx` or names such as `question.id.mdx`. */
function readSourceLocale(file: string) {
  return locales.find(
    (locale) =>
      file.endsWith(`/${locale}.mdx`) || file.endsWith(`.${locale}.mdx`)
  );
}

/**
 * Normalizes runtime absolute content paths to the repo-relative paths used by
 * source classification. Incremental sync receives both shapes: git output is
 * content-root relative, while `runtime.ts` expands those files to absolute
 * `packages/contents` paths before handing them to the workflow planner.
 */
function readContentRepositoryPath(file: string) {
  const normalizedFile = file.replaceAll("\\", "/");
  const packagePrefix = "packages/contents/";
  const packageSegment = `/${packagePrefix}`;

  if (normalizedFile.startsWith(packagePrefix)) {
    return normalizedFile;
  }

  const packageSegmentIndex = normalizedFile.indexOf(packageSegment);

  if (packageSegmentIndex >= 0) {
    return normalizedFile.slice(packageSegmentIndex + 1);
  }

  return `${packagePrefix}${normalizedFile}`;
}

/** Return whether a changed path belongs to authored article content. */
function isArticleSourcePath(file: string) {
  return file.includes("/articles/");
}

/** Return whether a changed path owns official article-author membership. */
function isArticleTeamSourcePath(file: string) {
  return file === "packages/contents/team/source.ts";
}

/** Return whether a changed path owns a cross-source content contract. */
function isSharedContentContractPath(file: string) {
  return (
    file === "packages/contents/_types/content.ts" ||
    file === "packages/contents/_types/taxonomy.ts"
  );
}

/** Return whether a changed path owns shared article and material date parsing. */
function isSharedDatePath(file: string) {
  return file === "packages/contents/_shared/date.ts";
}

/** Return whether a changed path belongs to authored curriculum content. */
function isCurriculumSourcePath(file: string) {
  return file.includes("/curriculum/");
}

/** Return whether a changed path can affect try-out projections. */
function isTryoutSourcePath(file: string) {
  return (
    file.includes("/tryout/") ||
    file.includes("/question-bank/tryout/") ||
    file.startsWith("packages/contents/_types/question-bank/")
  );
}

/** Return whether a changed path owns learning-graph projection logic. */
function isGraphProjectionPath(file: string) {
  return (
    file.startsWith("packages/contents/_types/graph/") ||
    file === "packages/contents/_types/learning-graph.ts"
  );
}

/** Return whether a changed path owns the material registry contract. */
function isMaterialRegistryPath(file: string) {
  return (
    file.startsWith("packages/contents/_types/material/") ||
    file === "packages/contents/_types/curriculum/material.ts"
  );
}

/** Return whether a changed path belongs to authored material content. */
function isMaterialSourcePath(file: string) {
  return file.includes("/material/");
}

/** Return whether a changed path belongs to authored Quran content. */
function isQuranSourcePath(file: string) {
  return (
    file.includes("/quran/") ||
    file === "packages/contents/_lib/quran.ts" ||
    file === "packages/contents/_types/quran.ts"
  );
}

/** Return whether a changed path owns learning-program catalog data. */
function isProgramCatalogPath(file: string) {
  return file.startsWith("packages/contents/_types/program/");
}

/** Return whether a changed path owns public route projections. */
function isRouteProjectionPath(file: string) {
  return file.startsWith("packages/contents/_types/route/");
}
