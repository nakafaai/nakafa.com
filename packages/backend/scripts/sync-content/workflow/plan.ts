/** Content row sync phases that must finish before route artifacts are rebuilt. */
export type IncrementalSyncRowPhase = "articles" | "curriculum" | "exercises";

/**
 * Ordered work plan for one incremental sync pass.
 *
 * Row phases repair persisted content rows such as `contentRoutes` and
 * `contentSearch`; route artifacts and generated read models are derived from
 * those rows and therefore run after the planned row phases.
 */
export interface IncrementalSyncPlan {
  readonly cleanBeforeRouteArtifacts: boolean;
  readonly refreshGeneratedReadModels: boolean;
  readonly rowPhases: readonly IncrementalSyncRowPhase[];
}

/**
 * Builds the ordered incremental sync plan from changed repository paths.
 *
 * Projection modules are part of the persisted content-row contract: route and
 * graph changes can alter `contentRoutes`, `contentSearch`, and generated
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
  const hasContentTaxonomyChanges = sourcePaths.some(isContentTaxonomyPath);
  const hasMaterialRegistryChanges = sourcePaths.some(isMaterialRegistryPath);
  const articleRowsChanged =
    hasGraphProjectionChanges ||
    hasContentTaxonomyChanges ||
    sourcePaths.some(isArticleSourcePath);
  const curriculumRowsChanged =
    hasContentProjectionChanges ||
    hasContentTaxonomyChanges ||
    hasMaterialRegistryChanges ||
    sourcePaths.some(isMaterialSourcePath) ||
    sourcePaths.some(isCurriculumSourcePath);
  const exerciseRowsChanged =
    hasContentProjectionChanges ||
    hasContentTaxonomyChanges ||
    hasMaterialRegistryChanges ||
    sourcePaths.some(isExerciseSourcePath);
  const rowPhases: IncrementalSyncRowPhase[] = [];

  if (articleRowsChanged) {
    rowPhases.push("articles");
  }
  if (curriculumRowsChanged) {
    rowPhases.push("curriculum");
  }
  if (exerciseRowsChanged) {
    rowPhases.push("exercises");
  }

  return {
    cleanBeforeRouteArtifacts: rowPhases.length > 0,
    refreshGeneratedReadModels: curriculumRowsChanged || exerciseRowsChanged,
    rowPhases,
  };
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

function isArticleSourcePath(file: string) {
  return file.includes("/articles/");
}

function isContentTaxonomyPath(file: string) {
  return file === "packages/contents/_types/taxonomy.ts";
}

function isCurriculumSourcePath(file: string) {
  return file.includes("/curriculum/");
}

function isExerciseSourcePath(file: string) {
  return file.includes("/material/practice/") || file.includes("/assessment/");
}

function isGraphProjectionPath(file: string) {
  return file.startsWith("packages/contents/_types/graph/");
}

function isMaterialRegistryPath(file: string) {
  return (
    file.startsWith("packages/contents/_types/material/") ||
    file === "packages/contents/_types/assessment/material.ts" ||
    file === "packages/contents/_types/curriculum/material.ts"
  );
}

function isMaterialSourcePath(file: string) {
  return file.includes("/material/");
}

function isRouteProjectionPath(file: string) {
  return file.startsWith("packages/contents/_types/route/");
}
