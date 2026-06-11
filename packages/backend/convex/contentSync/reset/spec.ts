import { v } from "convex/values";

export const resetBatchSize = 500;
export const eventTryoutEntitlementBatchSize = 500;

export const batchDeleteResultValidator = v.object({
  deleted: v.number(),
  hasMore: v.boolean(),
});

export type ResettableTableName =
  | "articleContents"
  | "articleReferences"
  | "audioContentSources"
  | "audioGenerationQueue"
  | "authors"
  | "contentAuthors"
  | "contentRouteCounts"
  | "contentRoutePages"
  | "contentRoutes"
  | "exerciseAnswers"
  | "exerciseAttempts"
  | "exerciseChoices"
  | "exerciseItemParameters"
  | "exerciseQuestions"
  | "exerciseSets"
  | "tryoutAccessCampaigns"
  | "tryoutAccessCampaignProducts"
  | "tryoutAccessGrants"
  | "tryoutAccessLinks"
  | "irtCalibrationAttempts"
  | "irtCalibrationCacheStats"
  | "irtCalibrationQueue"
  | "irtCalibrationRuns"
  | "irtScaleQualityChecks"
  | "irtScaleQualityRefreshQueue"
  | "irtScalePublicationQueue"
  | "irtScaleVersionItems"
  | "irtScaleVersions"
  | "contentSearch"
  | "quranSurahs"
  | "quranVerses"
  | "subjectSections"
  | "subjectTopics"
  | "tryoutAttempts"
  | "tryoutCatalogMeta"
  | "tryoutLeaderboardEntries"
  | "tryoutPartAttempts"
  | "tryoutPartSets"
  | "tryouts"
  | "userTryoutStats";
