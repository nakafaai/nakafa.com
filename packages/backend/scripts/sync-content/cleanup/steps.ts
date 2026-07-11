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

const reset = internal.contentSync.reset.internal;

/**
 * Ordered reset plan for sync-managed content and derived runtime rows.
 *
 * Dependent rows are deleted before their source rows so reset never leaves a
 * temporary dangling state inside one bounded batch family.
 */
export const RESET_STEPS: ResetStep[] = [
  {
    label: "Deleting content search rows...",
    mutation: reset.deleteContentSearchBatch,
    resultLabel: "content search rows",
  },
  {
    label: "Deleting learning engagement queue...",
    mutation: reset.deleteLearningEngagementQueueBatch,
    resultLabel: "learning engagement queue rows",
  },
  {
    label: "Deleting content analytics partition leases...",
    mutation: reset.deleteContentAnalyticsPartitionsBatch,
    resultLabel: "content analytics partition leases",
  },
  {
    label: "Deleting learning view rows...",
    mutation: reset.deleteLearningViewsBatch,
    resultLabel: "learning view rows",
  },
  {
    label: "Deleting user learning recents rows...",
    mutation: reset.deleteUserLearningRecentsBatch,
    resultLabel: "user learning recents rows",
  },
  {
    label: "Deleting learning popularity signal rows...",
    mutation: reset.deleteLearningPopularitySignalsBatch,
    resultLabel: "learning popularity signal rows",
  },
  {
    label: "Deleting learning popularity viewer signal rows...",
    mutation: reset.deleteLearningPopularityViewerSignalsBatch,
    resultLabel: "learning popularity viewer signal rows",
  },
  {
    label: "Deleting learning popularity counter rows...",
    mutation: reset.deleteLearningPopularityCountersBatch,
    resultLabel: "learning popularity counter rows",
  },
  {
    label: "Deleting generated learning plan items...",
    mutation: reset.deleteLearningPlanItemsBatch,
    resultLabel: "generated learning plan items",
  },
  {
    label: "Deleting learning program coverage rows...",
    mutation: reset.deleteLearningProgramCoverageBatch,
    resultLabel: "learning program coverage rows",
  },
  {
    label: "Deleting content route rows...",
    mutation: reset.deleteContentRoutesBatch,
    resultLabel: "content route rows",
  },
  {
    label: "Deleting public route rows...",
    mutation: reset.deletePublicRoutesBatch,
    resultLabel: "public route rows",
  },
  {
    label: "Deleting public route sync state...",
    mutation: reset.deletePublicRouteSyncStateBatch,
    resultLabel: "public route sync state rows",
  },
  {
    label: "Deleting content route count rows...",
    mutation: reset.deleteContentRouteCountsBatch,
    resultLabel: "content route count rows",
  },
  {
    label: "Deleting content route artifact pages...",
    mutation: reset.deleteContentRoutePagesBatch,
    resultLabel: "content route artifact pages",
  },
  {
    label: "Deleting Quran verses...",
    mutation: reset.deleteQuranVersesBatch,
    resultLabel: "Quran verses",
  },
  {
    label: "Deleting Quran surahs...",
    mutation: reset.deleteQuranSurahsBatch,
    resultLabel: "Quran surahs",
  },
  {
    label: "Deleting content authors...",
    mutation: reset.deleteContentAuthorsBatch,
    resultLabel: "content authors",
  },
  {
    label: "Deleting article references...",
    mutation: reset.deleteArticleReferencesBatch,
    resultLabel: "article references",
  },
  {
    label: "Deleting question choices...",
    mutation: reset.deleteQuestionChoicesBatch,
    resultLabel: "question choices",
  },
  {
    label: "Deleting audio generation queue...",
    mutation: reset.deleteAudioGenerationQueueBatch,
    resultLabel: "audio generation queue entries",
  },
  {
    label: "Deleting generated content audio...",
    mutation: reset.deleteContentAudiosBatch,
    resultLabel: "generated content audio rows",
  },
  {
    label: "Deleting audio content sources...",
    mutation: reset.deleteAudioContentSourcesBatch,
    resultLabel: "audio content sources",
  },
  {
    label: "Deleting try-out responses...",
    mutation: reset.deleteTryoutResponsesBatch,
    resultLabel: "try-out responses",
  },
  {
    label: "Deleting try-out attempt placements...",
    mutation: reset.deleteTryoutAttemptPlacementsBatch,
    resultLabel: "try-out attempt placements",
  },
  {
    label: "Deleting try-out section attempts...",
    mutation: reset.deleteTryoutSectionAttemptsBatch,
    resultLabel: "try-out section attempts",
  },
  {
    label: "Deleting try-out runtime rows...",
    mutation: reset.deleteTryoutRuntimeBatch,
    resultLabel: "try-out runtime rows",
  },
  {
    label: "Deleting try-out scores...",
    mutation: reset.deleteTryoutScoresBatch,
    resultLabel: "try-out scores",
  },
  {
    label: "Deleting try-out leaderboard entries...",
    mutation: reset.deleteTryoutLeaderboardEntriesBatch,
    resultLabel: "try-out leaderboard entries",
  },
  {
    label: "Deleting try-out leaderboard user stats...",
    mutation: reset.deleteTryoutLeaderboardUserStatsBatch,
    resultLabel: "try-out leaderboard user stats",
  },
  {
    label: "Deleting try-out leaderboard scopes...",
    mutation: reset.deleteTryoutLeaderboardScopesBatch,
    resultLabel: "try-out leaderboard scopes",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutation: reset.deleteIrtScalePublicationQueueBatch,
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale items...",
    mutation: reset.deleteIrtScaleItemsBatch,
    resultLabel: "IRT scale items",
  },
  {
    label: "Deleting IRT scale quality checks...",
    mutation: reset.deleteIrtScaleQualityChecksBatch,
    resultLabel: "IRT scale quality checks",
  },
  {
    label: "Deleting IRT scale quality refresh queue...",
    mutation: reset.deleteIrtScaleQualityRefreshQueueBatch,
    resultLabel: "IRT scale quality refresh queue entries",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutation: reset.deleteIrtCalibrationQueueBatch,
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting IRT calibration attempts...",
    mutation: reset.deleteIrtCalibrationAttemptsBatch,
    resultLabel: "IRT calibration attempts",
  },
  {
    label: "Deleting IRT calibration cache stats...",
    mutation: reset.deleteIrtCalibrationCacheStatsBatch,
    resultLabel: "IRT calibration cache stats",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutation: reset.deleteIrtCalibrationRunsBatch,
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting try-out set progress...",
    mutation: reset.deleteTryoutSetProgressBatch,
    resultLabel: "try-out set progress rows",
  },
  {
    label: "Deleting try-out attempts...",
    mutation: reset.deleteTryoutAttemptsBatch,
    resultLabel: "try-out attempts",
  },
  {
    label: "Deleting try-out entitlements...",
    mutation: reset.deleteTryoutEntitlementsBatch,
    resultLabel: "try-out entitlements",
  },
  {
    label: "Deleting try-out access grants...",
    mutation: reset.deleteTryoutAccessGrantsBatch,
    resultLabel: "try-out access grants",
  },
  {
    label: "Deleting try-out access links...",
    mutation: reset.deleteTryoutAccessLinksBatch,
    resultLabel: "try-out access links",
  },
  {
    label: "Deleting try-out access targets...",
    mutation: reset.deleteTryoutAccessTargetsBatch,
    resultLabel: "try-out access targets",
  },
  {
    label: "Deleting try-out access campaigns...",
    mutation: reset.deleteTryoutAccessCampaignsBatch,
    resultLabel: "try-out access campaigns",
  },
  {
    label: "Deleting try-out sections...",
    mutation: reset.deleteTryoutSectionsBatch,
    resultLabel: "try-out sections",
  },
  {
    label: "Deleting questions...",
    mutation: reset.deleteQuestionsBatch,
    resultLabel: "questions",
  },
  {
    label: "Deleting question sets...",
    mutation: reset.deleteQuestionSetsBatch,
    resultLabel: "question sets",
  },
  {
    label: "Deleting try-out sets...",
    mutation: reset.deleteTryoutSetsBatch,
    resultLabel: "try-out sets",
  },
  {
    label: "Deleting try-out tracks...",
    mutation: reset.deleteTryoutTracksBatch,
    resultLabel: "try-out tracks",
  },
  {
    label: "Deleting try-out exams...",
    mutation: reset.deleteTryoutExamsBatch,
    resultLabel: "try-out exams",
  },
  {
    label: "Deleting try-out countries...",
    mutation: reset.deleteTryoutCountriesBatch,
    resultLabel: "try-out countries",
  },
  {
    label: "Deleting IRT scale versions...",
    mutation: reset.deleteIrtScaleVersionsBatch,
    resultLabel: "IRT scale versions",
  },
  {
    label: "Deleting curriculum lessons...",
    mutation: reset.deleteCurriculumLessonsBatch,
    resultLabel: "curriculum lessons",
  },
  {
    label: "Deleting curriculum topics...",
    mutation: reset.deleteCurriculumTopicsBatch,
    resultLabel: "curriculum topics",
  },
  {
    label: "Deleting articles...",
    mutation: reset.deleteArticlesBatch,
    resultLabel: "articles",
  },
];
