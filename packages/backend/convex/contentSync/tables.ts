/**
 * Single source for sync-managed table counts used by Convex reset
 * queries and the local sync scripts.
 */
export const contentCountTables = [
  { field: "articles", tableName: "articleContents" },
  { field: "curriculumTopics", tableName: "curriculumTopics" },
  { field: "curriculumLessons", tableName: "curriculumLessons" },
  { field: "tryoutAccessCampaigns", tableName: "tryoutAccessCampaigns" },
  { field: "tryoutAccessTargets", tableName: "tryoutAccessTargets" },
  { field: "tryoutAccessLinks", tableName: "tryoutAccessLinks" },
  { field: "tryoutAccessGrants", tableName: "tryoutAccessGrants" },
  { field: "tryoutEntitlements", tableName: "tryoutEntitlements" },
  { field: "tryoutAttempts", tableName: "tryoutAttempts" },
  { field: "tryoutSetProgress", tableName: "tryoutSetProgress" },
  { field: "tryoutSectionAttempts", tableName: "tryoutSectionAttempts" },
  { field: "tryoutAttemptPlacements", tableName: "tryoutAttemptPlacements" },
  { field: "tryoutResponses", tableName: "tryoutResponses" },
  { field: "tryoutScores", tableName: "tryoutScores" },
  { field: "irtCalibrationRuns", tableName: "irtCalibrationRuns" },
  { field: "irtScaleVersions", tableName: "irtScaleVersions" },
  { field: "irtScaleItems", tableName: "irtScaleItems" },
  { field: "contentSearch", tableName: "contentSearch" },
  { field: "learningViews", tableName: "learningViews" },
  {
    field: "learningEngagementQueue",
    tableName: "learningEngagementQueue",
  },
  {
    field: "contentAnalyticsPartitions",
    tableName: "contentAnalyticsPartitions",
  },
  { field: "userLearningRecents", tableName: "userLearningRecents" },
  {
    field: "learningPopularityViewerSignals",
    tableName: "learningPopularityViewerSignals",
  },
  {
    field: "learningPopularitySignals",
    tableName: "learningPopularitySignals",
  },
  {
    field: "learningPopularityCounters",
    tableName: "learningPopularityCounters",
  },
  { field: "learningPrograms", tableName: "learningPrograms" },
  { field: "learningProgramSources", tableName: "learningProgramSources" },
  { field: "learningPlanItems", tableName: "learningPlanItems" },
  { field: "learningProgramCoverage", tableName: "learningProgramCoverage" },
  { field: "contentRoutes", tableName: "contentRoutes" },
  { field: "publicRoutes", tableName: "publicRoutes" },
  { field: "publicRouteSyncState", tableName: "publicRouteSyncState" },
  {
    field: "publicRouteSitemapCounts",
    tableName: "publicRouteSitemapCounts",
  },
  {
    field: "publicRouteSitemapPages",
    tableName: "publicRouteSitemapPages",
  },
  { field: "contentRouteCounts", tableName: "contentRouteCounts" },
  { field: "contentRoutePages", tableName: "contentRoutePages" },
  { field: "quranSurahs", tableName: "quranSurahs" },
  { field: "quranVerses", tableName: "quranVerses" },
  { field: "authors", tableName: "authors" },
  { field: "contentAuthors", tableName: "contentAuthors" },
  { field: "articleReferences", tableName: "articleReferences" },
] as const;

/** Table names accepted by the paginated count query. */
export const contentCountTableNames = contentCountTables.map(
  ({ tableName }) => tableName
);
