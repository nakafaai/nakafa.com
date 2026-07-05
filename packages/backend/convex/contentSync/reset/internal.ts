import {
  createBatchDeleteMutation,
  deleteContentAudioRows,
  deleteContentSearchRows,
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
/** Delete one bounded batch of stored learning view rows. */
export const deleteLearningViewsBatch =
  createBatchDeleteMutation("learningViews");
/** Delete one bounded batch of queued learning engagement events. */
export const deleteLearningEngagementQueueBatch = createBatchDeleteMutation(
  "learningEngagementQueue"
);
/** Delete one bounded batch of analytics partition checkpoint rows. */
export const deleteContentAnalyticsPartitionsBatch = createBatchDeleteMutation(
  "contentAnalyticsPartitions"
);

/** Delete one bounded batch of graph-backed user learning recents rows. */
export const deleteUserLearningRecentsBatch = createBatchDeleteMutation(
  "userLearningRecents"
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

/** Delete one bounded batch of generated material identity rows. */
export const deleteMaterialsBatch = createBatchDeleteMutation("materials");

/** Delete one bounded batch of generated localized material rows. */
export const deleteMaterialLocalesBatch =
  createBatchDeleteMutation("materialLocales");

/** Delete one bounded batch of generated curriculum rows. */
export const deleteCurriculaBatch = createBatchDeleteMutation("curricula");

/** Delete one bounded batch of generated curriculum node rows. */
export const deleteCurriculumNodesBatch =
  createBatchDeleteMutation("curriculumNodes");

/** Delete one bounded batch of generated curriculum material link rows. */
export const deleteCurriculumMaterialsBatch = createBatchDeleteMutation(
  "curriculumMaterials"
);

/** Delete one bounded batch of generated assessment rows. */
export const deleteAssessmentsBatch = createBatchDeleteMutation("assessments");

/** Delete one bounded batch of generated assessment node rows. */
export const deleteAssessmentNodesBatch =
  createBatchDeleteMutation("assessmentNodes");

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
export const deleteContentRouteCountsBatch =
  createBatchDeleteMutation("contentRouteCounts");
export const deleteContentRoutePagesBatch =
  createBatchDeleteMutation("contentRoutePages");
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
export const deleteTryoutSetsBatch = createBatchDeleteMutation("tryoutSets");
export const deleteTryoutSectionsBatch =
  createBatchDeleteMutation("tryoutSections");
export const deleteIrtScaleVersionsBatch =
  createBatchDeleteMutation("irtScaleVersions");
export const deleteIrtCalibrationRunsBatch =
  createBatchDeleteMutation("irtCalibrationRuns");
export const deleteQuestionsBatch = createBatchDeleteMutation("questions");
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
