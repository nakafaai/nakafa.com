import {
  deleteBatchFromTable,
  deleteContentAudioRows,
  deleteContentSearchRows,
} from "@repo/backend/convex/contentSync/reset/impl";
import {
  batchDeleteResultValidator,
  type ResettableTableName,
} from "@repo/backend/convex/contentSync/reset/spec";
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
export const deleteQuranVersesBatch = createBatchDeleteMutation("quranVerses");
export const deleteQuranSurahsBatch = createBatchDeleteMutation("quranSurahs");
export const deleteArticleReferencesBatch =
  createBatchDeleteMutation("articleReferences");
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
export const deleteCurriculumLessonsBatch =
  createBatchDeleteMutation("curriculumLessons");
export const deleteCurriculumTopicsBatch =
  createBatchDeleteMutation("curriculumTopics");
export const deleteArticlesBatch = createBatchDeleteMutation("articleContents");
export const deleteAuthorsBatch = createBatchDeleteMutation("authors");
