import { internal } from "@repo/backend/convex/_generated/api";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";

export type BatchDeleteMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  { deleted: number; hasMore: boolean }
>;

/** One bounded Convex table reset step in the full content reset sequence. */
export interface ResetStep {
  label: string;
  mutation: BatchDeleteMutation;
  resultLabel: string;
}

/**
 * Ordered reset plan for sync-managed content and derived runtime rows.
 *
 * The order is part of the cleanup contract: dependent rows are deleted before
 * their source rows so Convex table triggers and integrity checks never observe
 * dangling reset state.
 */
export const RESET_STEPS: ResetStep[] = [
  {
    label: "Deleting content search rows...",
    mutation: internal.contentSync.reset.internal.deleteContentSearchBatch,
    resultLabel: "content search rows",
  },
  {
    label: "Deleting learning engagement queue...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningEngagementQueueBatch,
    resultLabel: "learning engagement queue rows",
  },
  {
    label: "Deleting content analytics partition leases...",
    mutation:
      internal.contentSync.reset.internal.deleteContentAnalyticsPartitionsBatch,
    resultLabel: "content analytics partition leases",
  },
  {
    label: "Deleting learning view rows...",
    mutation: internal.contentSync.reset.internal.deleteLearningViewsBatch,
    resultLabel: "learning view rows",
  },
  {
    label: "Deleting user learning recents rows...",
    mutation:
      internal.contentSync.reset.internal.deleteUserLearningRecentsBatch,
    resultLabel: "user learning recents rows",
  },
  {
    label: "Deleting learning popularity signal rows...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningPopularitySignalsBatch,
    resultLabel: "learning popularity signal rows",
  },
  {
    label: "Deleting learning popularity viewer signal rows...",
    mutation:
      internal.contentSync.reset.internal
        .deleteLearningPopularityViewerSignalsBatch,
    resultLabel: "learning popularity viewer signal rows",
  },
  {
    label: "Deleting learning popularity counter rows...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningPopularityCountersBatch,
    resultLabel: "learning popularity counter rows",
  },
  {
    label: "Deleting generated assessment nodes...",
    mutation: internal.contentSync.reset.internal.deleteAssessmentNodesBatch,
    resultLabel: "generated assessment nodes",
  },
  {
    label: "Deleting generated assessments...",
    mutation: internal.contentSync.reset.internal.deleteAssessmentsBatch,
    resultLabel: "generated assessments",
  },
  {
    label: "Deleting generated curriculum material links...",
    mutation:
      internal.contentSync.reset.internal.deleteCurriculumMaterialsBatch,
    resultLabel: "generated curriculum material links",
  },
  {
    label: "Deleting generated curriculum nodes...",
    mutation: internal.contentSync.reset.internal.deleteCurriculumNodesBatch,
    resultLabel: "generated curriculum nodes",
  },
  {
    label: "Deleting generated curricula...",
    mutation: internal.contentSync.reset.internal.deleteCurriculaBatch,
    resultLabel: "generated curricula",
  },
  {
    label: "Deleting generated material locale rows...",
    mutation: internal.contentSync.reset.internal.deleteMaterialLocalesBatch,
    resultLabel: "generated material locale rows",
  },
  {
    label: "Deleting generated material rows...",
    mutation: internal.contentSync.reset.internal.deleteMaterialsBatch,
    resultLabel: "generated material rows",
  },
  {
    label: "Deleting generated learning plan items...",
    mutation: internal.contentSync.reset.internal.deleteLearningPlanItemsBatch,
    resultLabel: "generated learning plan items",
  },
  {
    label: "Deleting learning program coverage rows...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningProgramCoverageBatch,
    resultLabel: "learning program coverage rows",
  },
  {
    label: "Deleting content route rows...",
    mutation: internal.contentSync.reset.internal.deleteContentRoutesBatch,
    resultLabel: "content route rows",
  },
  {
    label: "Deleting public route rows...",
    mutation: internal.contentSync.reset.internal.deletePublicRoutesBatch,
    resultLabel: "public route rows",
  },
  {
    label: "Deleting content route count rows...",
    mutation: internal.contentSync.reset.internal.deleteContentRouteCountsBatch,
    resultLabel: "content route count rows",
  },
  {
    label: "Deleting content route artifact pages...",
    mutation: internal.contentSync.reset.internal.deleteContentRoutePagesBatch,
    resultLabel: "content route artifact pages",
  },
  {
    label: "Deleting Quran verses...",
    mutation: internal.contentSync.reset.internal.deleteQuranVersesBatch,
    resultLabel: "Quran verses",
  },
  {
    label: "Deleting Quran surahs...",
    mutation: internal.contentSync.reset.internal.deleteQuranSurahsBatch,
    resultLabel: "Quran surahs",
  },
  {
    label: "Deleting content authors...",
    mutation: internal.contentSync.reset.internal.deleteContentAuthorsBatch,
    resultLabel: "content authors",
  },
  {
    label: "Deleting article references...",
    mutation: internal.contentSync.reset.internal.deleteArticleReferencesBatch,
    resultLabel: "article references",
  },
  {
    label: "Deleting exercise choices...",
    mutation: internal.contentSync.reset.internal.deleteExerciseChoicesBatch,
    resultLabel: "exercise choices",
  },
  {
    label: "Deleting exercise answers...",
    mutation: internal.contentSync.reset.internal.deleteExerciseAnswersBatch,
    resultLabel: "exercise answers",
  },
  {
    label: "Deleting audio generation queue...",
    mutation:
      internal.contentSync.reset.internal.deleteAudioGenerationQueueBatch,
    resultLabel: "audio generation queue entries",
  },
  {
    label: "Deleting generated content audio...",
    mutation: internal.contentSync.reset.internal.deleteContentAudiosBatch,
    resultLabel: "generated content audio rows",
  },
  {
    label: "Deleting audio content sources...",
    mutation:
      internal.contentSync.reset.internal.deleteAudioContentSourcesBatch,
    resultLabel: "audio content sources",
  },
  {
    label: "Deleting tryout part attempts...",
    mutation: internal.contentSync.reset.internal.deleteTryoutPartAttemptsBatch,
    resultLabel: "tryout part attempts",
  },
  {
    label: "Deleting tryout leaderboard entries...",
    mutation:
      internal.contentSync.reset.internal.deleteTryoutLeaderboardEntriesBatch,
    resultLabel: "tryout leaderboard entries",
  },
  {
    label: "Deleting user tryout stats...",
    mutation: internal.contentSync.reset.internal.deleteUserTryoutStatsBatch,
    resultLabel: "user tryout stats",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtScalePublicationQueueBatch,
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale version items...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtScaleVersionItemsBatch,
    resultLabel: "IRT scale version items",
  },
  {
    label: "Deleting exercise item parameters...",
    mutation:
      internal.contentSync.reset.internal.deleteExerciseItemParametersBatch,
    resultLabel: "exercise item parameters",
  },
  {
    label: "Deleting IRT scale quality checks...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtScaleQualityChecksBatch,
    resultLabel: "IRT scale quality checks",
  },
  {
    label: "Deleting IRT scale quality refresh queue...",
    mutation:
      internal.contentSync.reset.internal
        .deleteIrtScaleQualityRefreshQueueBatch,
    resultLabel: "IRT scale quality refresh queue entries",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtCalibrationQueueBatch,
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting IRT calibration attempts...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtCalibrationAttemptsBatch,
    resultLabel: "IRT calibration attempts",
  },
  {
    label: "Deleting IRT calibration cache stats...",
    mutation:
      internal.contentSync.reset.internal.deleteIrtCalibrationCacheStatsBatch,
    resultLabel: "IRT calibration cache stats",
  },
  {
    label: "Deleting exercise attempts...",
    mutation: internal.contentSync.reset.internal.deleteExerciseAttemptsBatch,
    resultLabel: "exercise attempts",
  },
  {
    label: "Deleting tryout attempts...",
    mutation: internal.contentSync.reset.internal.deleteTryoutAttemptsBatch,
    resultLabel: "tryout attempts",
  },
  {
    label: "Deleting tryout entitlements...",
    mutation: internal.contentSync.reset.internal.deleteTryoutEntitlementsBatch,
    resultLabel: "tryout entitlements",
  },
  {
    label: "Deleting tryout access grants...",
    mutation: internal.contentSync.reset.internal.deleteTryoutAccessGrantsBatch,
    resultLabel: "tryout access grants",
  },
  {
    label: "Deleting tryout access campaign products...",
    mutation:
      internal.contentSync.reset.internal
        .deleteTryoutAccessCampaignProductsBatch,
    resultLabel: "tryout access campaign products",
  },
  {
    label: "Deleting tryout access links...",
    mutation: internal.contentSync.reset.internal.deleteTryoutAccessLinksBatch,
    resultLabel: "tryout access links",
  },
  {
    label: "Deleting tryout access campaigns...",
    mutation:
      internal.contentSync.reset.internal.deleteTryoutAccessCampaignsBatch,
    resultLabel: "tryout access campaigns",
  },
  {
    label: "Deleting tryout catalog meta...",
    mutation: internal.contentSync.reset.internal.deleteTryoutCatalogMetaBatch,
    resultLabel: "tryout catalog meta rows",
  },
  {
    label: "Deleting tryout part sets...",
    mutation: internal.contentSync.reset.internal.deleteTryoutPartSetsBatch,
    resultLabel: "tryout part sets",
  },
  {
    label: "Deleting IRT scale versions...",
    mutation: internal.contentSync.reset.internal.deleteIrtScaleVersionsBatch,
    resultLabel: "IRT scale versions",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutation: internal.contentSync.reset.internal.deleteIrtCalibrationRunsBatch,
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting tryouts...",
    mutation: internal.contentSync.reset.internal.deleteTryoutsBatch,
    resultLabel: "tryouts",
  },
  {
    label: "Deleting exercise questions...",
    mutation: internal.contentSync.reset.internal.deleteExerciseQuestionsBatch,
    resultLabel: "exercise questions",
  },
  {
    label: "Deleting curriculum lessons...",
    mutation: internal.contentSync.reset.internal.deleteCurriculumLessonsBatch,
    resultLabel: "curriculum lessons",
  },
  {
    label: "Deleting exercise sets...",
    mutation: internal.contentSync.reset.internal.deleteExerciseSetsBatch,
    resultLabel: "exercise sets",
  },
  {
    label: "Deleting curriculum topics...",
    mutation: internal.contentSync.reset.internal.deleteCurriculumTopicsBatch,
    resultLabel: "curriculum topics",
  },
  {
    label: "Deleting articles...",
    mutation: internal.contentSync.reset.internal.deleteArticlesBatch,
    resultLabel: "articles",
  },
];
