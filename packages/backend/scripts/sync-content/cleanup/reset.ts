import { internal } from "@repo/backend/convex/_generated/api";
import {
  type BatchDeleteMutation,
  RESET_STEPS,
} from "@repo/backend/scripts/sync-content/cleanup/steps";
import {
  formatDuration,
  log,
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { getContentCounts } from "@repo/backend/scripts/sync-content/convex/counts";
import { clearSyncState } from "@repo/backend/scripts/sync-content/runtime/files";
import { Effect } from "effect";

/** Deletes every row exposed by one bounded reset mutation. */
const deleteAllBatched = Effect.fn("sync.reset.deleteAllBatched")(function* (
  config: ConvexConfig,
  mutation: BatchDeleteMutation,
  label: string
) {
  let totalDeleted = 0;
  let batchNum = 1;
  let hasMore = true;

  while (hasMore) {
    const result = yield* callConvexMutation(
      config,
      mutation,
      {},
      BatchDeleteResultSchema
    );
    totalDeleted += result.deleted;
    hasMore = result.hasMore;

    if (result.deleted > 0) {
      yield* Effect.sync(() =>
        process.stdout.write(
          `\r  Batch ${batchNum}: deleted ${totalDeleted} ${label}...`
        )
      );
      batchNum++;
    }
  }

  if (totalDeleted > 0) {
    yield* Effect.sync(() => process.stdout.write("\n"));
  }
  return totalDeleted;
});

/** Deletes the full sync-managed content graph and its derived runtime rows. */
export const reset = Effect.fn("sync.reset")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("=== RESET CONTENT ===\n");
  log(
    "This will DELETE synced content and the runtime data derived from it.\n"
  );

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning("This will permanently delete all content from production.\n");
  }
  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  log("Current database contents:\n");
  const counts = yield* getContentCounts(config);

  log(`  Content Search:        ${counts.contentSearch}`);
  log(`  Learning Views:        ${counts.learningViews}`);
  log(`  Engagement Queue:      ${counts.learningEngagementQueue}`);
  log(`  Analytics Partitions:  ${counts.contentAnalyticsPartitions}`);
  log(`  User Recents:          ${counts.userLearningRecents}`);
  log(`  Viewer Signals:        ${counts.learningPopularityViewerSignals}`);
  log(`  Popularity Signals:    ${counts.learningPopularitySignals}`);
  log(`  Popularity Counters:   ${counts.learningPopularityCounters}`);
  log(`  Materials:             ${counts.materials}`);
  log(`  Material Locales:      ${counts.materialLocales}`);
  log(`  Curricula:             ${counts.curricula}`);
  log(`  Curriculum Nodes:      ${counts.curriculumNodes}`);
  log(`  Curriculum Materials:  ${counts.curriculumMaterials}`);
  log(`  Assessments:           ${counts.assessments}`);
  log(`  Assessment Nodes:      ${counts.assessmentNodes}`);
  log(`  Learning Programs:     ${counts.learningPrograms}`);
  log(`  Learning Program Srcs: ${counts.learningProgramSources}`);
  log(`  Learning Plan Items:   ${counts.learningPlanItems}`);
  log(`  Learning Program Cov:  ${counts.learningProgramCoverage}`);
  log(`  Content Routes:        ${counts.contentRoutes}`);
  log(`  Public Routes:         ${counts.publicRoutes}`);
  log(`  Content Route Counts:  ${counts.contentRouteCounts}`);
  log(`  Content Route Pages:   ${counts.contentRoutePages}`);
  log(`  Quran Surahs:          ${counts.quranSurahs}`);
  log(`  Quran Verses:          ${counts.quranVerses}`);
  log(`  Content Authors:       ${counts.contentAuthors}`);
  log(`  Article References:    ${counts.articleReferences}`);
  log(`  Question Sets:         ${counts.questionSets}`);
  log(`  Questions:             ${counts.questions}`);
  log(`  Question Choices:      ${counts.questionChoices}`);
  log(`  Audio Content Sources: ${counts.audioContentSources}`);
  log(`  Content Audios:        ${counts.contentAudios}`);
  log(`  Audio Queue:           ${counts.audioGenerationQueue}`);
  log(`  Tryout Access Campaigns: ${counts.tryoutAccessCampaigns}`);
  log(`  Tryout Access Targets:   ${counts.tryoutAccessTargets}`);
  log(`  Tryout Access Links:     ${counts.tryoutAccessLinks}`);
  log(`  Tryout Access Grants:    ${counts.tryoutAccessGrants}`);
  log(`  Tryout Countries:      ${counts.tryoutCountries}`);
  log(`  Tryout Exams:          ${counts.tryoutExams}`);
  log(`  Tryout Sets:           ${counts.tryoutSets}`);
  log(`  Tryout Sections:       ${counts.tryoutSections}`);
  log(`  Tryout Entitlements:   ${counts.tryoutEntitlements}`);
  log(`  Tryout Attempts:       ${counts.tryoutAttempts}`);
  log(`  Tryout Section Attempts:${counts.tryoutSectionAttempts}`);
  log(`  Tryout Placements:     ${counts.tryoutAttemptPlacements}`);
  log(`  Tryout Responses:      ${counts.tryoutResponses}`);
  log(`  Tryout Scores:         ${counts.tryoutScores}`);
  log(`  Tryout Leaderboards:   ${counts.tryoutLeaderboardScopes}`);
  log(`  Tryout Leaderboard Rows:${counts.tryoutLeaderboardEntries}`);
  log(`  Tryout Leaderboard Stats:${counts.tryoutLeaderboardUserStats}`);
  log(`  IRT Calibration Queue: ${counts.irtCalibrationQueue}`);
  log(`  IRT Calibration Rows:  ${counts.irtCalibrationAttempts}`);
  log(`  IRT Cache Stats:       ${counts.irtCalibrationCacheStats}`);
  log(`  IRT Calibration Runs:  ${counts.irtCalibrationRuns}`);
  log(`  IRT Scale Quality:     ${counts.irtScaleQualityChecks}`);
  log(`  IRT Scale Quality Q:   ${counts.irtScaleQualityRefreshQueue}`);
  log(`  IRT Scale Queue:       ${counts.irtScalePublicationQueue}`);
  log(`  IRT Scale Versions:    ${counts.irtScaleVersions}`);
  log(`  IRT Scale Items:       ${counts.irtScaleItems}`);
  log(`  Curriculum Lessons:    ${counts.curriculumLessons}`);
  log(`  Curriculum Topics:     ${counts.curriculumTopics}`);
  log(`  Articles:              ${counts.articles}`);
  log(`  Authors:               ${counts.authors}`);

  const totalContent =
    counts.articles +
    counts.curriculumTopics +
    counts.curriculumLessons +
    counts.questionSets +
    counts.questions +
    counts.tryoutCountries +
    counts.tryoutExams +
    counts.tryoutSets +
    counts.tryoutSections;
  const totalRelated =
    counts.contentAuthors + counts.articleReferences + counts.questionChoices;
  const totalRuntime =
    counts.audioGenerationQueue +
    counts.tryoutAccessCampaigns +
    counts.tryoutAccessTargets +
    counts.tryoutAccessLinks +
    counts.tryoutAccessGrants +
    counts.tryoutEntitlements +
    counts.tryoutAttempts +
    counts.tryoutSectionAttempts +
    counts.tryoutAttemptPlacements +
    counts.tryoutResponses +
    counts.tryoutScores +
    counts.tryoutLeaderboardScopes +
    counts.tryoutLeaderboardEntries +
    counts.tryoutLeaderboardUserStats +
    counts.irtCalibrationQueue +
    counts.irtCalibrationAttempts +
    counts.irtCalibrationCacheStats +
    counts.irtCalibrationRuns +
    counts.irtScaleQualityChecks +
    counts.irtScaleQualityRefreshQueue +
    counts.irtScalePublicationQueue +
    counts.irtScaleVersions +
    counts.irtScaleItems;
  const totalDerived =
    counts.contentSearch +
    counts.learningViews +
    counts.learningEngagementQueue +
    counts.contentAnalyticsPartitions +
    counts.userLearningRecents +
    counts.learningPopularityViewerSignals +
    counts.learningPopularitySignals +
    counts.learningPopularityCounters +
    counts.materials +
    counts.materialLocales +
    counts.curricula +
    counts.curriculumNodes +
    counts.curriculumMaterials +
    counts.assessments +
    counts.assessmentNodes +
    counts.learningPlanItems +
    counts.learningProgramCoverage +
    counts.contentRoutes +
    counts.publicRoutes +
    counts.contentRouteCounts +
    counts.contentRoutePages +
    counts.quranSurahs +
    counts.quranVerses +
    counts.audioContentSources +
    counts.contentAudios;
  const totalPreserved =
    counts.learningProgramSources + counts.learningPrograms;
  log(`\n  Total content items:  ${totalContent}`);
  log(`  Total related items:  ${totalRelated}`);
  log(`  Total runtime items:  ${totalRuntime}`);
  log(`  Total derived items:  ${totalDerived}`);
  log(`  Total preserved items: ${totalPreserved}`);

  if (
    totalContent === 0 &&
    totalRelated === 0 &&
    totalRuntime === 0 &&
    totalDerived === 0
  ) {
    logSuccess("\nReset-managed content is already empty. Nothing to delete.");
    return;
  }

  if (!options.force) {
    log("\nTo delete all content, run:");
    if (options.prod) {
      log("  pnpm --filter @repo/backend sync:reset --prod --force");
    } else {
      log("  pnpm --filter @repo/backend sync:reset --force");
    }
    if (!options.authors) {
      log("\nTo also delete authors, add --authors flag");
    }
    return;
  }

  log("\nDeleting content (in dependency order)...\n");
  const startTime = performance.now();
  let totalDeleted = 0;

  for (const [index, step] of RESET_STEPS.entries()) {
    log(`${index + 1}/${RESET_STEPS.length} ${step.label}`);
    const deleted = yield* deleteAllBatched(
      config,
      step.mutation,
      step.resultLabel
    );
    logSuccess(`  Deleted ${deleted} ${step.resultLabel}`);
    totalDeleted += deleted;
  }

  if (options.authors) {
    log("Deleting authors...");
    const authorsDeleted = yield* deleteAllBatched(
      config,
      internal.contentSync.reset.internal.deleteAuthorsBatch,
      "authors"
    );
    logSuccess(`  Deleted ${authorsDeleted} authors`);
    totalDeleted += authorsDeleted;
  } else {
    log("Skipping authors (use --authors to include)");
  }

  log("\n=== RESET COMPLETE ===\n");
  logSuccess(
    `Deleted ${totalDeleted} items in ${formatDuration(performance.now() - startTime)}`
  );
  yield* clearSyncState(options.prod ?? false);
  log("Cleared sync state file");

  log("\nTo re-sync content, run:");
  if (options.prod) {
    log("  pnpm --filter @repo/backend sync:prod");
  } else {
    log("  pnpm --filter @repo/backend sync");
  }
});
