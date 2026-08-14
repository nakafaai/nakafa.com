import type { TableNames } from "@repo/backend/convex/_generated/dataModel";
import { v } from "convex/values";

export const resetBatchSize = 500;
export const contentSearchResetBatchSize = 100;

export const batchDeleteResultValidator = v.object({
  deleted: v.number(),
  hasMore: v.boolean(),
});

export const resettableTableNames = [
  "articleContents",
  "articleReferences",
  "authors",
  "contentAnalyticsPartitions",
  "contentAuthors",
  "contentRouteCounts",
  "contentRoutePages",
  "contentRoutes",
  "publicRouteSitemapCounts",
  "publicRouteSitemapPages",
  "publicRoutes",
  "publicRouteSyncState",
  "contentSearch",
  "learningEngagementQueue",
  "learningPopularityCounters",
  "learningPopularitySignals",
  "learningPopularityViewerSignals",
  "learningPlanItems",
  "learningProgramCoverage",
  "quranSurahs",
  "quranVerses",
  "curriculumLessons",
  "curriculumTopics",
] as const satisfies readonly TableNames[];

export type ResettableTableName = (typeof resettableTableNames)[number];
