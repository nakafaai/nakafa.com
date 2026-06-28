import type { TableNames } from "@repo/backend/convex/_generated/dataModel";
import { v } from "convex/values";

export const resetBatchSize = 500;
export const contentSearchResetBatchSize = 100;
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
  "exerciseAnswers",
  "exerciseAttempts",
  "exerciseChoices",
  "exerciseItemParameters",
  "exerciseQuestions",
  "exerciseSets",
  "irtCalibrationAttempts",
  "irtCalibrationCacheStats",
  "irtCalibrationQueue",
  "irtCalibrationRuns",
  "irtScalePublicationQueue",
  "irtScaleQualityChecks",
  "irtScaleQualityRefreshQueue",
  "irtScaleVersionItems",
  "irtScaleVersions",
  "learningPopularityCounters",
  "learningPopularitySignals",
  "learningPopularityViewerSignals",
  "assessmentNodes",
  "assessments",
  "curricula",
  "curriculumMaterials",
  "curriculumNodes",
  "materialLocales",
  "materials",
  "learningPlanItems",
  "learningProgramCoverage",
  "quranSurahs",
  "quranVerses",
  "curriculumLessons",
  "curriculumTopics",
  "userLearningRecents",
  "tryoutAccessCampaignProducts",
  "tryoutAccessCampaigns",
  "tryoutAccessGrants",
  "tryoutAccessLinks",
  "tryoutAttempts",
  "tryoutCatalogMeta",
  "tryoutLeaderboardEntries",
  "tryoutPartAttempts",
  "tryoutPartSets",
  "tryouts",
  "userTryoutStats",
] as const satisfies readonly TableNames[];

export type ResettableTableName = (typeof resettableTableNames)[number];
