/**
 * Single source for sync-managed table counts used by Convex reset
 * queries and the local sync scripts.
 */
export const contentCountTables = [
  { field: "articles", tableName: "articleContents" },
  { field: "subjectTopics", tableName: "subjectTopics" },
  { field: "subjectSections", tableName: "subjectSections" },
  { field: "exerciseSets", tableName: "exerciseSets" },
  { field: "exerciseQuestions", tableName: "exerciseQuestions" },
  { field: "exerciseAttempts", tableName: "exerciseAttempts" },
  { field: "exerciseAnswers", tableName: "exerciseAnswers" },
  { field: "tryoutAccessCampaigns", tableName: "tryoutAccessCampaigns" },
  {
    field: "tryoutAccessCampaignProducts",
    tableName: "tryoutAccessCampaignProducts",
  },
  { field: "tryoutAccessLinks", tableName: "tryoutAccessLinks" },
  { field: "tryoutAccessGrants", tableName: "tryoutAccessGrants" },
  { field: "tryouts", tableName: "tryouts" },
  { field: "tryoutCatalogMeta", tableName: "tryoutCatalogMeta" },
  { field: "userTryoutEntitlements", tableName: "userTryoutEntitlements" },
  { field: "tryoutPartSets", tableName: "tryoutPartSets" },
  { field: "tryoutAttempts", tableName: "tryoutAttempts" },
  { field: "tryoutPartAttempts", tableName: "tryoutPartAttempts" },
  {
    field: "tryoutLeaderboardEntries",
    tableName: "tryoutLeaderboardEntries",
  },
  { field: "userTryoutStats", tableName: "userTryoutStats" },
  { field: "irtCalibrationQueue", tableName: "irtCalibrationQueue" },
  { field: "irtCalibrationAttempts", tableName: "irtCalibrationAttempts" },
  { field: "irtCalibrationCacheStats", tableName: "irtCalibrationCacheStats" },
  { field: "irtCalibrationRuns", tableName: "irtCalibrationRuns" },
  { field: "irtScaleQualityChecks", tableName: "irtScaleQualityChecks" },
  {
    field: "irtScaleQualityRefreshQueue",
    tableName: "irtScaleQualityRefreshQueue",
  },
  { field: "exerciseItemParameters", tableName: "exerciseItemParameters" },
  {
    field: "irtScalePublicationQueue",
    tableName: "irtScalePublicationQueue",
  },
  { field: "irtScaleVersions", tableName: "irtScaleVersions" },
  { field: "irtScaleVersionItems", tableName: "irtScaleVersionItems" },
  { field: "contentSearch", tableName: "contentSearch" },
  { field: "contentViews", tableName: "contentViews" },
  {
    field: "contentViewAnalyticsQueue",
    tableName: "contentViewAnalyticsQueue",
  },
  {
    field: "contentAnalyticsPartitions",
    tableName: "contentAnalyticsPartitions",
  },
  { field: "learningPopularity", tableName: "learningPopularity" },
  { field: "learningTrendingBuckets", tableName: "learningTrendingBuckets" },
  { field: "learningPrograms", tableName: "learningPrograms" },
  { field: "learningProgramSources", tableName: "learningProgramSources" },
  { field: "learningProgramCoverage", tableName: "learningProgramCoverage" },
  { field: "contentRoutes", tableName: "contentRoutes" },
  { field: "contentRouteCounts", tableName: "contentRouteCounts" },
  { field: "contentRoutePages", tableName: "contentRoutePages" },
  { field: "quranSurahs", tableName: "quranSurahs" },
  { field: "quranVerses", tableName: "quranVerses" },
  { field: "authors", tableName: "authors" },
  { field: "contentAuthors", tableName: "contentAuthors" },
  { field: "articleReferences", tableName: "articleReferences" },
  { field: "exerciseChoices", tableName: "exerciseChoices" },
  { field: "audioContentSources", tableName: "audioContentSources" },
  { field: "contentAudios", tableName: "contentAudios" },
  { field: "audioGenerationQueue", tableName: "audioGenerationQueue" },
] as const;

/** Table names accepted by the paginated count query. */
export const contentCountTableNames = contentCountTables.map(
  ({ tableName }) => tableName
);
