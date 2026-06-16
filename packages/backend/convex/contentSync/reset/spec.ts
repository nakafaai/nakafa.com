import type { TableNames } from "@repo/backend/convex/_generated/dataModel";
import { v } from "convex/values";

export const resetBatchSize = 500;
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
  "contentSearch",
  "contentViewAnalyticsQueue",
  "contentViews",
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
  "learningPopularity",
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
  "learningTrendingBuckets",
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
