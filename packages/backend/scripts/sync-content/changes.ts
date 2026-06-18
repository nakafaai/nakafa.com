interface SyncContentFileChanges {
  hasArticleChanges: boolean;
  hasContentRouteChanges: boolean;
  hasCurriculumMaterialChanges: boolean;
  hasExerciseChanges: boolean;
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
  const hasExerciseChanges = changedFiles.some((file) =>
    file.includes("/assessment/")
  );

  return {
    hasArticleChanges,
    hasContentRouteChanges:
      hasArticleChanges ||
      hasMaterialChanges ||
      hasCurriculumMaterialChanges ||
      hasExerciseChanges,
    hasCurriculumMaterialChanges,
    hasExerciseChanges,
    hasMaterialChanges,
  };
}
