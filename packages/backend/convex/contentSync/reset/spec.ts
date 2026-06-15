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
  "learningProgramCoverage",
  "quranSurahs",
  "quranVerses",
  "subjectSections",
  "subjectTopics",
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

/**
 * Program catalog rows are sync-managed but intentionally preserved by the broad
 * content reset because learning profiles, plans, and plan items store generated
 * program document IDs. Program outline/outcome rows are source-registry read
 * models attached to those program IDs. Coverage rows are derived from content
 * routes and remain reset-managed because they can be rebuilt without orphaning
 * user state.
 */
export const preservedProgramCatalogTableNames = [
  "learningPrograms",
  "learningProgramSources",
  "learningProgramOutlineNodes",
  "learningProgramOutcomes",
  "learningProgramOutcomeConcepts",
] as const satisfies readonly TableNames[];

export type PreservedProgramCatalogTableName =
  (typeof preservedProgramCatalogTableNames)[number];
