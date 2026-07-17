/**
 * Single source for sync-managed table counts used by Convex reset
 * queries and the local sync scripts.
 */
export const contentCountTables = [
  { field: "articles", tableName: "articleContents" },
  { field: "curriculumTopics", tableName: "curriculumTopics" },
  { field: "curriculumLessons", tableName: "curriculumLessons" },
  { field: "questionSets", tableName: "questionSets" },
  { field: "questions", tableName: "questions" },
  { field: "questionChoices", tableName: "questionChoices" },
  { field: "tryoutAccessCampaigns", tableName: "tryoutAccessCampaigns" },
  { field: "tryoutAccessTargets", tableName: "tryoutAccessTargets" },
  { field: "tryoutAccessLinks", tableName: "tryoutAccessLinks" },
  { field: "tryoutAccessGrants", tableName: "tryoutAccessGrants" },
  { field: "tryoutCountries", tableName: "tryoutCountries" },
  { field: "tryoutExams", tableName: "tryoutExams" },
  { field: "tryoutTracks", tableName: "tryoutTracks" },
  { field: "tryoutSets", tableName: "tryoutSets" },
  { field: "tryoutSections", tableName: "tryoutSections" },
  { field: "tryoutEntitlements", tableName: "tryoutEntitlements" },
  { field: "tryoutAttempts", tableName: "tryoutAttempts" },
  { field: "tryoutSetProgress", tableName: "tryoutSetProgress" },
  { field: "tryoutSectionAttempts", tableName: "tryoutSectionAttempts" },
  { field: "tryoutAttemptPlacements", tableName: "tryoutAttemptPlacements" },
  { field: "tryoutResponses", tableName: "tryoutResponses" },
  { field: "tryoutScores", tableName: "tryoutScores" },
  { field: "tryoutLeaderboardScopes", tableName: "tryoutLeaderboardScopes" },
  {
    field: "tryoutLeaderboardEntries",
    tableName: "tryoutLeaderboardEntries",
  },
  {
    field: "tryoutLeaderboardUserStats",
    tableName: "tryoutLeaderboardUserStats",
  },
  { field: "irtCalibrationQueue", tableName: "irtCalibrationQueue" },
  { field: "irtCalibrationAttempts", tableName: "irtCalibrationAttempts" },
  { field: "irtCalibrationCacheStats", tableName: "irtCalibrationCacheStats" },
  { field: "irtCalibrationRuns", tableName: "irtCalibrationRuns" },
  { field: "irtScaleQualityChecks", tableName: "irtScaleQualityChecks" },
  {
    field: "irtScaleQualityRefreshQueue",
    tableName: "irtScaleQualityRefreshQueue",
  },
  {
    field: "irtScalePublicationQueue",
    tableName: "irtScalePublicationQueue",
  },
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
  { field: "audioContentSources", tableName: "audioContentSources" },
  { field: "contentAudios", tableName: "contentAudios" },
  { field: "audioGenerationQueue", tableName: "audioGenerationQueue" },
] as const;

/** Table names accepted by the paginated count query. */
export const contentCountTableNames = contentCountTables.map(
  ({ tableName }) => tableName
);
