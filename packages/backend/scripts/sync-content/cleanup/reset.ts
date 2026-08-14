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
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/contract/inspection";
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

/** Deletes the sync-managed content graph while preserving learner history. */
export const reset = Effect.fn("sync.reset")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("=== RESET CONTENT ===\n");
  log(
    "This will DELETE reset-managed filesystem projections. Signed publication and durable learner state are preserved.\n"
  );

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning(
      "This will permanently delete reset-managed projections from production.\n"
    );
  }
  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  log("Current database contents:\n");
  const counts = yield* getContentCounts(config);

  log(`  Content Search:        ${counts.contentSearch}`);
  log(`  Learning Views (preserved): ${counts.learningViews}`);
  log(`  Engagement Queue:      ${counts.learningEngagementQueue}`);
  log(`  Analytics Partitions:  ${counts.contentAnalyticsPartitions}`);
  log(`  User Recents (preserved): ${counts.userLearningRecents}`);
  log(`  Viewer Signals:        ${counts.learningPopularityViewerSignals}`);
  log(`  Popularity Signals:    ${counts.learningPopularitySignals}`);
  log(`  Popularity Counters:   ${counts.learningPopularityCounters}`);
  log(`  Learning Programs (preserved): ${counts.learningPrograms}`);
  log(
    `  Learning Program Sources (preserved): ${counts.learningProgramSources}`
  );
  log(`  Learning Plan Items:   ${counts.learningPlanItems}`);
  log(`  Learning Program Cov:  ${counts.learningProgramCoverage}`);
  log(`  Content Routes:        ${counts.contentRoutes}`);
  log(`  Public Routes:         ${counts.publicRoutes}`);
  log(`  Public Route State:    ${counts.publicRouteSyncState}`);
  log(`  Public Sitemap Counts: ${counts.publicRouteSitemapCounts}`);
  log(`  Public Sitemap Pages:  ${counts.publicRouteSitemapPages}`);
  log(`  Content Route Counts:  ${counts.contentRouteCounts}`);
  log(`  Content Route Pages:   ${counts.contentRoutePages}`);
  log(`  Quran Surahs:          ${counts.quranSurahs}`);
  log(`  Quran Verses:          ${counts.quranVerses}`);
  log(`  Content Authors:       ${counts.contentAuthors}`);
  log(`  Article References:    ${counts.articleReferences}`);
  log(`  Tryout Access Campaigns (preserved): ${counts.tryoutAccessCampaigns}`);
  log(`  Tryout Access Targets (preserved): ${counts.tryoutAccessTargets}`);
  log(`  Tryout Access Links (preserved): ${counts.tryoutAccessLinks}`);
  log(`  Tryout Access Grants (preserved): ${counts.tryoutAccessGrants}`);
  log(`  Tryout Entitlements (preserved): ${counts.tryoutEntitlements}`);
  log(`  Tryout Attempts (preserved): ${counts.tryoutAttempts}`);
  log(`  Tryout Set Progress (preserved): ${counts.tryoutSetProgress}`);
  log(`  Tryout Section Attempts (preserved): ${counts.tryoutSectionAttempts}`);
  log(`  Tryout Placements (preserved): ${counts.tryoutAttemptPlacements}`);
  log(`  Tryout Responses (preserved): ${counts.tryoutResponses}`);
  log(`  Tryout Scores (preserved): ${counts.tryoutScores}`);
  log(`  IRT Calibration Runs (preserved): ${counts.irtCalibrationRuns}`);
  log(`  IRT Scale Versions (preserved): ${counts.irtScaleVersions}`);
  log(`  IRT Scale Items (preserved): ${counts.irtScaleItems}`);
  log(`  Curriculum Lessons:    ${counts.curriculumLessons}`);
  log(`  Curriculum Topics:     ${counts.curriculumTopics}`);
  log(`  Articles:              ${counts.articles}`);
  log(`  Authors:               ${counts.authors}`);

  const totalContent =
    counts.articles + counts.curriculumTopics + counts.curriculumLessons;
  const totalRelated = counts.contentAuthors + counts.articleReferences;
  const totalDerived =
    counts.contentSearch +
    counts.learningEngagementQueue +
    counts.contentAnalyticsPartitions +
    counts.learningPopularityViewerSignals +
    counts.learningPopularitySignals +
    counts.learningPopularityCounters +
    counts.learningPlanItems +
    counts.learningProgramCoverage +
    counts.contentRoutes +
    counts.publicRoutes +
    counts.publicRouteSyncState +
    counts.publicRouteSitemapCounts +
    counts.publicRouteSitemapPages +
    counts.contentRouteCounts +
    counts.contentRoutePages +
    counts.quranSurahs +
    counts.quranVerses;
  const totalPreserved =
    counts.learningProgramSources +
    counts.learningPrograms +
    counts.learningViews +
    counts.userLearningRecents +
    counts.tryoutAccessCampaigns +
    counts.tryoutAccessTargets +
    counts.tryoutAccessLinks +
    counts.tryoutAccessGrants +
    counts.tryoutEntitlements +
    counts.tryoutAttempts +
    counts.tryoutSetProgress +
    counts.tryoutSectionAttempts +
    counts.tryoutAttemptPlacements +
    counts.tryoutResponses +
    counts.tryoutScores +
    counts.irtCalibrationRuns +
    counts.irtScaleVersions +
    counts.irtScaleItems;
  log(`\n  Total content items:  ${totalContent}`);
  log(`  Total related items:  ${totalRelated}`);
  log(`  Total derived items:  ${totalDerived}`);
  log(`  Total preserved items: ${totalPreserved}`);

  if (totalContent === 0 && totalRelated === 0 && totalDerived === 0) {
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
