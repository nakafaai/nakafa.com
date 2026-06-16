import {
  createBatchDeleteMutation,
  deleteContentAudioRows,
  deleteTryoutEntitlementRows,
  deleteTryoutRuntimeRows,
} from "@repo/backend/convex/contentSync/reset/impl";
import { batchDeleteResultValidator } from "@repo/backend/convex/contentSync/reset/spec";
import { internalMutation } from "@repo/backend/convex/functions";

/**
 * Delete one bounded batch of tryout part attempts together with their linked
 * tryout-owned exercise attempts and exercise answers.
 *
 * This is intentionally narrower than the full content reset path so operators
 * can wipe tryout runtime data without touching standalone exercise history.
 */
export const deleteTryoutRuntimeBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteTryoutRuntimeRows,
});

export const deleteContentAuthorsBatch =
  createBatchDeleteMutation("contentAuthors");
export const deleteContentSearchBatch =
  createBatchDeleteMutation("contentSearch");
export const deleteContentViewsBatch =
  createBatchDeleteMutation("contentViews");
export const deleteContentViewAnalyticsQueueBatch = createBatchDeleteMutation(
  "contentViewAnalyticsQueue"
);
export const deleteContentAnalyticsPartitionsBatch = createBatchDeleteMutation(
  "contentAnalyticsPartitions"
);

/** Delete one bounded batch of graph-backed learning popularity rows. */
export const deleteLearningPopularityBatch =
  createBatchDeleteMutation("learningPopularity");

/** Delete one bounded batch of graph-backed learning trend bucket rows. */
export const deleteLearningTrendingBucketsBatch = createBatchDeleteMutation(
  "learningTrendingBuckets"
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
export const deleteLearningProgramSourcesBatch = createBatchDeleteMutation(
  "learningProgramSources"
);
export const deleteLearningProgramsBatch =
  createBatchDeleteMutation("learningPrograms");
export const deleteContentRoutesBatch =
  createBatchDeleteMutation("contentRoutes");
export const deleteContentRouteCountsBatch =
  createBatchDeleteMutation("contentRouteCounts");
export const deleteContentRoutePagesBatch =
  createBatchDeleteMutation("contentRoutePages");
export const deleteQuranVersesBatch = createBatchDeleteMutation("quranVerses");
export const deleteQuranSurahsBatch = createBatchDeleteMutation("quranSurahs");
export const deleteArticleReferencesBatch =
  createBatchDeleteMutation("articleReferences");
export const deleteExerciseChoicesBatch =
  createBatchDeleteMutation("exerciseChoices");
export const deleteExerciseAnswersBatch =
  createBatchDeleteMutation("exerciseAnswers");
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
export const deleteTryoutPartAttemptsBatch =
  createBatchDeleteMutation("tryoutPartAttempts");
export const deleteTryoutLeaderboardEntriesBatch = createBatchDeleteMutation(
  "tryoutLeaderboardEntries"
);
export const deleteUserTryoutStatsBatch =
  createBatchDeleteMutation("userTryoutStats");
export const deleteIrtScalePublicationQueueBatch = createBatchDeleteMutation(
  "irtScalePublicationQueue"
);
export const deleteIrtScaleVersionItemsBatch = createBatchDeleteMutation(
  "irtScaleVersionItems"
);
export const deleteExerciseItemParametersBatch = createBatchDeleteMutation(
  "exerciseItemParameters"
);
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
export const deleteExerciseAttemptsBatch =
  createBatchDeleteMutation("exerciseAttempts");
export const deleteTryoutAttemptsBatch =
  createBatchDeleteMutation("tryoutAttempts");
export const deleteTryoutAccessCampaignsBatch = createBatchDeleteMutation(
  "tryoutAccessCampaigns"
);
export const deleteTryoutAccessCampaignProductsBatch =
  createBatchDeleteMutation("tryoutAccessCampaignProducts");
export const deleteTryoutAccessGrantsBatch =
  createBatchDeleteMutation("tryoutAccessGrants");
export const deleteTryoutAccessLinksBatch =
  createBatchDeleteMutation("tryoutAccessLinks");
export const deleteTryoutCatalogMetaBatch =
  createBatchDeleteMutation("tryoutCatalogMeta");
export const deleteTryoutPartSetsBatch =
  createBatchDeleteMutation("tryoutPartSets");
export const deleteIrtScaleVersionsBatch =
  createBatchDeleteMutation("irtScaleVersions");
export const deleteIrtCalibrationRunsBatch =
  createBatchDeleteMutation("irtCalibrationRuns");
export const deleteTryoutsBatch = createBatchDeleteMutation("tryouts");
export const deleteExerciseQuestionsBatch =
  createBatchDeleteMutation("exerciseQuestions");
export const deleteExerciseSetsBatch =
  createBatchDeleteMutation("exerciseSets");
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
