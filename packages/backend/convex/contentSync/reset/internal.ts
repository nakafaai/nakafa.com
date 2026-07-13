import {
  createBatchDeleteMutation,
  deleteContentAudioRows,
  deleteContentSearchRows,
  deleteQuestionRows,
  deleteTryoutContentRouteCountRows,
  deleteTryoutContentRoutePageRows,
  deleteTryoutContentRouteRows,
  deleteTryoutContentSearchRows,
  deleteTryoutEntitlementRows,
  deleteTryoutRuntimeRows,
} from "@repo/backend/convex/contentSync/reset/impl";
import { batchDeleteResultValidator } from "@repo/backend/convex/contentSync/reset/spec";
import { internalMutation } from "@repo/backend/convex/functions";

/**
 * Delete one bounded batch of section attempts owned by tryout attempts.
 *
 * This is intentionally narrower than the full content reset path so operators
 * can wipe tryout runtime data in dependency order.
 */
export const deleteTryoutRuntimeBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteTryoutRuntimeRows,
});

export const deleteContentAuthorsBatch =
  createBatchDeleteMutation("contentAuthors");
/** Delete one bounded batch of large full-text search rows. */
export const deleteContentSearchBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteContentSearchRows,
});
/** Delete one bounded batch of queued learning engagement events. */
export const deleteLearningEngagementQueueBatch = createBatchDeleteMutation(
  "learningEngagementQueue"
);
/** Delete one bounded batch of analytics partition checkpoint rows. */
export const deleteContentAnalyticsPartitionsBatch = createBatchDeleteMutation(
  "contentAnalyticsPartitions"
);

/** Delete one bounded batch of graph-backed learning popularity signal rows. */
export const deleteLearningPopularitySignalsBatch = createBatchDeleteMutation(
  "learningPopularitySignals"
);

/** Delete one bounded batch of daily viewer popularity dedupe rows. */
export const deleteLearningPopularityViewerSignalsBatch =
  createBatchDeleteMutation("learningPopularityViewerSignals");

/** Delete one bounded batch of graph-backed learning popularity counter rows. */
export const deleteLearningPopularityCountersBatch = createBatchDeleteMutation(
  "learningPopularityCounters"
);

/** Delete one bounded batch of generated learning plan item rows. */
export const deleteLearningPlanItemsBatch =
  createBatchDeleteMutation("learningPlanItems");

/** Delete one bounded batch of graph-backed learning program coverage rows. */
export const deleteLearningProgramCoverageBatch = createBatchDeleteMutation(
  "learningProgramCoverage"
);
export const deleteContentRoutesBatch =
  createBatchDeleteMutation("contentRoutes");
export const deletePublicRoutesBatch =
  createBatchDeleteMutation("publicRoutes");
export const deletePublicRouteSyncStateBatch = createBatchDeleteMutation(
  "publicRouteSyncState"
);
export const deleteContentRouteCountsBatch =
  createBatchDeleteMutation("contentRouteCounts");
export const deleteContentRoutePagesBatch =
  createBatchDeleteMutation("contentRoutePages");
/** Delete one bounded batch of try-out route projection rows. */
export const deleteTryoutContentRoutesBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteTryoutContentRouteRows,
});
/** Delete one bounded batch of try-out search projection rows. */
export const deleteTryoutContentSearchBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteTryoutContentSearchRows,
});
/** Delete one bounded batch of try-out route count rows. */
export const deleteTryoutContentRouteCountsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteTryoutContentRouteCountRows,
});
/** Delete one bounded batch of try-out route artifact pages. */
export const deleteTryoutContentRoutePagesBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteTryoutContentRoutePageRows,
});
export const deleteQuranVersesBatch = createBatchDeleteMutation("quranVerses");
export const deleteQuranSurahsBatch = createBatchDeleteMutation("quranSurahs");
export const deleteArticleReferencesBatch =
  createBatchDeleteMutation("articleReferences");
export const deleteQuestionChoicesBatch =
  createBatchDeleteMutation("questionChoices");
export const deleteAudioGenerationQueueBatch = createBatchDeleteMutation(
  "audioGenerationQueue"
);
export const deleteAudioContentSourcesBatch = createBatchDeleteMutation(
  "audioContentSources"
);

/**
 * Deletes generated audio rows with their Convex storage blobs.
 *
 * @see https://docs.convex.dev/file-storage/delete-files
 */
export const deleteContentAudiosBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteContentAudioRows,
});
export const deleteTryoutSectionAttemptsBatch = createBatchDeleteMutation(
  "tryoutSectionAttempts"
);
export const deleteTryoutAttemptPlacementsBatch = createBatchDeleteMutation(
  "tryoutAttemptPlacements"
);
export const deleteTryoutResponsesBatch =
  createBatchDeleteMutation("tryoutResponses");
export const deleteTryoutScoresBatch =
  createBatchDeleteMutation("tryoutScores");
export const deleteTryoutLeaderboardScopesBatch = createBatchDeleteMutation(
  "tryoutLeaderboardScopes"
);
export const deleteTryoutLeaderboardEntriesBatch = createBatchDeleteMutation(
  "tryoutLeaderboardEntries"
);
export const deleteTryoutLeaderboardUserStatsBatch = createBatchDeleteMutation(
  "tryoutLeaderboardUserStats"
);
export const deleteIrtScalePublicationQueueBatch = createBatchDeleteMutation(
  "irtScalePublicationQueue"
);
export const deleteIrtScaleItemsBatch =
  createBatchDeleteMutation("irtScaleItems");
export const deleteIrtCalibrationQueueBatch = createBatchDeleteMutation(
  "irtCalibrationQueue"
);
export const deleteIrtCalibrationAttemptsBatch = createBatchDeleteMutation(
  "irtCalibrationAttempts"
);
export const deleteIrtCalibrationCacheStatsBatch = createBatchDeleteMutation(
  "irtCalibrationCacheStats"
);
export const deleteIrtScaleQualityChecksBatch = createBatchDeleteMutation(
  "irtScaleQualityChecks"
);
export const deleteIrtScaleQualityRefreshQueueBatch = createBatchDeleteMutation(
  "irtScaleQualityRefreshQueue"
);
export const deleteTryoutAttemptsBatch =
  createBatchDeleteMutation("tryoutAttempts");
export const deleteTryoutSetProgressBatch =
  createBatchDeleteMutation("tryoutSetProgress");
export const deleteTryoutAccessCampaignsBatch = createBatchDeleteMutation(
  "tryoutAccessCampaigns"
);
export const deleteTryoutAccessTargetsBatch = createBatchDeleteMutation(
  "tryoutAccessTargets"
);
export const deleteTryoutAccessGrantsBatch =
  createBatchDeleteMutation("tryoutAccessGrants");
export const deleteTryoutAccessLinksBatch =
  createBatchDeleteMutation("tryoutAccessLinks");
export const deleteTryoutCountriesBatch =
  createBatchDeleteMutation("tryoutCountries");
export const deleteTryoutExamsBatch = createBatchDeleteMutation("tryoutExams");
export const deleteTryoutTracksBatch =
  createBatchDeleteMutation("tryoutTracks");
export const deleteTryoutSetsBatch = createBatchDeleteMutation("tryoutSets");
export const deleteTryoutSectionsBatch =
  createBatchDeleteMutation("tryoutSections");
export const deleteIrtScaleVersionsBatch =
  createBatchDeleteMutation("irtScaleVersions");
export const deleteIrtCalibrationRunsBatch =
  createBatchDeleteMutation("irtCalibrationRuns");
export const deleteQuestionsBatch = createBatchDeleteMutation("questions");
/** Delete one bounded question batch through dependent cleanup. */
export const deleteQuestionsWithDependentsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteQuestionRows,
});
export const deleteQuestionSetsBatch =
  createBatchDeleteMutation("questionSets");
export const deleteCurriculumLessonsBatch =
  createBatchDeleteMutation("curriculumLessons");
export const deleteCurriculumTopicsBatch =
  createBatchDeleteMutation("curriculumTopics");
export const deleteArticlesBatch = createBatchDeleteMutation("articleContents");
export const deleteAuthorsBatch = createBatchDeleteMutation("authors");

/** Delete one bounded batch of stored tryout entitlements. */
export const deleteTryoutEntitlementsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteTryoutEntitlementRows,
});
