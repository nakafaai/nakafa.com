/** Boolean invalidation contract consumed by the incremental sync workflow. */
interface SyncContentFileChanges {
  hasArticleChanges: boolean;
  hasContentRouteChanges: boolean;
  hasCurriculumMaterialChanges: boolean;
  hasExerciseChanges: boolean;
  hasGeneratedReadModelChanges: boolean;
  hasMaterialChanges: boolean;
}

/**
 * Classifies changed source paths into the sync phases they invalidate.
 *
 * The incremental workflow uses this as its routing policy so filesystem path
 * knowledge stays local to the sync-content script surface.
 */
export function readSyncContentFileChanges(
  changedFiles: readonly string[]
): SyncContentFileChanges {
  const hasArticleChanges = changedFiles.some((file) =>
    file.includes("/articles/")
  );
  const hasMaterialChanges = changedFiles.some((file) =>
    file.includes("/material/")
  );
  const hasCurriculumMaterialChanges = changedFiles.some((file) =>
    file.includes("/curriculum/")
  );
  const hasExerciseChanges = changedFiles.some(
    (file) =>
      file.includes("/material/practice/") || file.includes("/assessment/")
  );
  const hasRouteProjectionChanges = changedFiles.some(
    (file) =>
      file.startsWith("packages/contents/_types/route/") ||
      file.startsWith("packages/contents/_types/graph/")
  );
  const hasGeneratedReadModelChanges =
    hasMaterialChanges ||
    hasCurriculumMaterialChanges ||
    hasExerciseChanges ||
    hasRouteProjectionChanges;

  return {
    hasArticleChanges,
    hasContentRouteChanges:
      hasArticleChanges ||
      hasMaterialChanges ||
      hasCurriculumMaterialChanges ||
      hasExerciseChanges ||
      hasRouteProjectionChanges,
    hasCurriculumMaterialChanges,
    hasExerciseChanges,
    hasGeneratedReadModelChanges,
    hasMaterialChanges,
  };
}
