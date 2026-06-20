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
  const hasGraphProjectionChanges = changedFiles.some(isGraphProjectionPath);
  const hasRouteProjectionChanges = changedFiles.some(isRouteProjectionPath);
  const hasContentProjectionChanges =
    hasGraphProjectionChanges || hasRouteProjectionChanges;
  const articleRowsChanged =
    hasGraphProjectionChanges || changedFiles.some(isArticleSourcePath);
  const curriculumRowsChanged =
    hasContentProjectionChanges ||
    changedFiles.some(isMaterialSourcePath) ||
    changedFiles.some(isCurriculumSourcePath);
  const exerciseRowsChanged =
    hasContentProjectionChanges || changedFiles.some(isExerciseSourcePath);
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

function isArticleSourcePath(file: string) {
  return file.includes("/articles/");
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

function isMaterialSourcePath(file: string) {
  return file.includes("/material/");
}

function isRouteProjectionPath(file: string) {
  return file.startsWith("packages/contents/_types/route/");
}
