import type { TableNames } from "@repo/backend/convex/_generated/dataModel";
import { v } from "convex/values";

export const resetBatchSize = 500;
export const contentSearchResetBatchSize = 100;
export const questionResetBatchSize = 100;
export const eventTryoutEntitlementBatchSize = 500;

export const batchDeleteResultValidator = v.object({
  deleted: v.number(),
  hasMore: v.boolean(),
});

export const resettableTableNames = [
  "articleContents",
  "articleReferences",
  "audioContentSources",
  "audioGenerationQueue",
  "authors",
  "contentAnalyticsPartitions",
  "contentAuthors",
  "contentRouteCounts",
  "contentRoutePages",
  "contentRoutes",
  "publicRoutes",
  "contentSearch",
  "learningEngagementQueue",
  "learningViews",
  "questionChoices",
  "questions",
  "questionSets",
  "irtCalibrationAttempts",
  "irtCalibrationCacheStats",
  "irtCalibrationQueue",
  "irtCalibrationRuns",
  "irtScalePublicationQueue",
  "irtScaleQualityChecks",
  "irtScaleQualityRefreshQueue",
  "irtScaleItems",
  "irtScaleVersions",
  "learningPopularityCounters",
  "learningPopularitySignals",
  "learningPopularityViewerSignals",
  "learningPlanItems",
  "learningProgramCoverage",
  "quranSurahs",
  "quranVerses",
  "curriculumLessons",
  "curriculumTopics",
  "userLearningRecents",
  "tryoutAccessTargets",
  "tryoutAccessCampaigns",
  "tryoutAccessGrants",
  "tryoutAccessLinks",
  "tryoutCountries",
  "tryoutExams",
  "tryoutTracks",
  "tryoutSets",
  "tryoutSections",
  "tryoutAttempts",
  "tryoutSectionAttempts",
  "tryoutAttemptPlacements",
  "tryoutResponses",
  "tryoutScores",
  "tryoutLeaderboardScopes",
  "tryoutLeaderboardEntries",
  "tryoutLeaderboardUserStats",
] as const satisfies readonly TableNames[];

export type ResettableTableName = (typeof resettableTableNames)[number];
