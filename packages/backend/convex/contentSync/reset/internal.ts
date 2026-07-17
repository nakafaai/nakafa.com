import {
  deleteBatchFromTable,
  deleteContentAudioRows,
  deleteContentSearchRows,
} from "@repo/backend/convex/contentSync/reset/impl";
import {
  batchDeleteResultValidator,
  type ResettableTableName,
} from "@repo/backend/convex/contentSync/reset/spec";
import {
  deleteQuestionRows,
  deleteTryoutContentRouteCountRows,
  deleteTryoutContentRoutePageRows,
  deleteTryoutContentRouteRows,
  deleteTryoutContentSearchRows,
  deleteTryoutEntitlementRows,
} from "@repo/backend/convex/contentSync/reset/tryouts";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Creates one internal mutation that runs a bounded table reset program. */
function createBatchDeleteMutation(tableName: ResettableTableName) {
  return internalMutation({
    args: {},
    returns: batchDeleteResultValidator,
    handler: (ctx) => runConvexProgram(deleteBatchFromTable(ctx, tableName)),
  });
}

export const deleteContentAuthorsBatch =
  createBatchDeleteMutation("contentAuthors");
/** Delete one bounded batch of large full-text search rows. */
export const deleteContentSearchBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: (ctx) => runConvexProgram(deleteContentSearchRows(ctx)),
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
export const deletePublicRouteSitemapCountsBatch = createBatchDeleteMutation(
  "publicRouteSitemapCounts"
);
export const deletePublicRouteSitemapPagesBatch = createBatchDeleteMutation(
  "publicRouteSitemapPages"
);
export const deleteContentRouteCountsBatch =
  createBatchDeleteMutation("contentRouteCounts");
export const deleteContentRoutePagesBatch =
  createBatchDeleteMutation("contentRoutePages");
/** Delete one bounded batch of try-out route projection rows. */
export const deleteTryoutContentRoutesBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: (ctx) => runConvexProgram(deleteTryoutContentRouteRows(ctx)),
});
/** Delete one bounded batch of try-out search projection rows. */
export const deleteTryoutContentSearchBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: (ctx) => runConvexProgram(deleteTryoutContentSearchRows(ctx)),
});
/** Delete one bounded batch of try-out route count rows. */
export const deleteTryoutContentRouteCountsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: (ctx) => runConvexProgram(deleteTryoutContentRouteCountRows(ctx)),
});
/** Delete one bounded batch of try-out route artifact pages. */
export const deleteTryoutContentRoutePagesBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: (ctx) => runConvexProgram(deleteTryoutContentRoutePageRows(ctx)),
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
  handler: (ctx) => runConvexProgram(deleteContentAudioRows(ctx)),
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
  handler: (ctx) => runConvexProgram(deleteQuestionRows(ctx)),
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
  handler: (ctx) => runConvexProgram(deleteTryoutEntitlementRows(ctx)),
});
