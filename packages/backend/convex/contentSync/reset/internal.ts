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
export const deleteSubjectSectionsBatch =
  createBatchDeleteMutation("subjectSections");
export const deleteSubjectTopicsBatch =
  createBatchDeleteMutation("subjectTopics");
export const deleteArticlesBatch = createBatchDeleteMutation("articleContents");
export const deleteAuthorsBatch = createBatchDeleteMutation("authors");

/** Delete one bounded batch of stored tryout entitlements. */
export const deleteTryoutEntitlementsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: deleteTryoutEntitlementRows,
});
