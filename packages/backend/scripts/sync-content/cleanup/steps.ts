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
    label: "Deleting public sitemap count rows...",
    mutation: reset.deletePublicRouteSitemapCountsBatch,
    resultLabel: "public sitemap count rows",
  },
  {
    label: "Deleting public sitemap artifact pages...",
    mutation: reset.deletePublicRouteSitemapPagesBatch,
    resultLabel: "public sitemap artifact pages",
  },
  {
    label: "Deleting public route sync state...",
    mutation: reset.deletePublicRouteSyncStateBatch,
    resultLabel: "public route sync state rows",
  },
  {
    label: "Deleting public route rows...",
    mutation: reset.deletePublicRoutesBatch,
    resultLabel: "public route rows",
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
