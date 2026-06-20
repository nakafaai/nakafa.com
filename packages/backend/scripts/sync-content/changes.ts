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
 * Projection modules are part of the content-row contract because runtime
 * rows store projected public paths and graph identities in `contentRoutes`
 * and `contentSearch`, not only in generated public-route read models.
 */
export function readSyncContentFileChanges(
  changedFiles: readonly string[]
): SyncContentFileChanges {
  const hasGraphProjectionChanges = changedFiles.some((file) =>
    file.startsWith("packages/contents/_types/graph/")
  );
  const hasRouteProjectionChanges = changedFiles.some((file) =>
    file.startsWith("packages/contents/_types/route/")
  );
  const hasContentProjectionChanges =
    hasGraphProjectionChanges || hasRouteProjectionChanges;
  const hasArticleChanges = changedFiles.some((file) =>
    file.includes("/articles/")
  );
  const hasMaterialChanges =
    hasContentProjectionChanges ||
    changedFiles.some((file) => file.includes("/material/"));
  const hasCurriculumMaterialChanges =
    hasContentProjectionChanges ||
    changedFiles.some((file) => file.includes("/curriculum/"));
  const hasExerciseChanges =
    hasContentProjectionChanges ||
    changedFiles.some(
      (file) =>
        file.includes("/material/practice/") || file.includes("/assessment/")
    );
  const hasArticleRowChanges = hasArticleChanges || hasGraphProjectionChanges;
  const hasGeneratedReadModelChanges =
    hasMaterialChanges ||
    hasCurriculumMaterialChanges ||
    hasExerciseChanges ||
    hasRouteProjectionChanges ||
    hasGraphProjectionChanges;

  return {
    hasArticleChanges: hasArticleRowChanges,
    hasContentRouteChanges:
      hasArticleRowChanges ||
      hasMaterialChanges ||
      hasCurriculumMaterialChanges ||
      hasExerciseChanges ||
      hasRouteProjectionChanges ||
      hasGraphProjectionChanges,
    hasCurriculumMaterialChanges,
    hasExerciseChanges,
    hasGeneratedReadModelChanges,
    hasMaterialChanges,
  };
}
