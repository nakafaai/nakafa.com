import { internal } from "@repo/backend/convex/_generated/api";
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
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";

type BatchDeleteMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  { deleted: number; hasMore: boolean }
>;

interface ResetStep {
  label: string;
  mutation: BatchDeleteMutation;
  resultLabel: string;
}

const reset = internal.contentSync.reset.internal;

const RESET_TRYOUT_STEPS: ResetStep[] = [
  {
    label: "Deleting try-out responses...",
    mutation: reset.deleteTryoutResponsesBatch,
    resultLabel: "try-out responses",
  },
  {
    label: "Deleting try-out attempt placements...",
    mutation: reset.deleteTryoutAttemptPlacementsBatch,
    resultLabel: "try-out attempt placements",
  },
  {
    label: "Deleting try-out section attempts...",
    mutation: reset.deleteTryoutSectionAttemptsBatch,
    resultLabel: "try-out section attempts",
  },
  {
    label: "Deleting try-out runtime rows...",
    mutation: reset.deleteTryoutRuntimeBatch,
    resultLabel: "try-out runtime rows",
  },
  {
    label: "Deleting try-out scores...",
    mutation: reset.deleteTryoutScoresBatch,
    resultLabel: "try-out scores",
  },
  {
    label: "Deleting try-out leaderboard entries...",
    mutation: reset.deleteTryoutLeaderboardEntriesBatch,
    resultLabel: "try-out leaderboard entries",
  },
  {
    label: "Deleting try-out leaderboard user stats...",
    mutation: reset.deleteTryoutLeaderboardUserStatsBatch,
    resultLabel: "try-out leaderboard user stats",
  },
  {
    label: "Deleting try-out leaderboard scopes...",
    mutation: reset.deleteTryoutLeaderboardScopesBatch,
    resultLabel: "try-out leaderboard scopes",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutation: reset.deleteIrtScalePublicationQueueBatch,
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale items...",
    mutation: reset.deleteIrtScaleItemsBatch,
    resultLabel: "IRT scale items",
  },
  {
    label: "Deleting IRT scale quality checks...",
    mutation: reset.deleteIrtScaleQualityChecksBatch,
    resultLabel: "IRT scale quality checks",
  },
  {
    label: "Deleting IRT scale quality refresh queue...",
    mutation: reset.deleteIrtScaleQualityRefreshQueueBatch,
    resultLabel: "IRT scale quality refresh queue entries",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutation: reset.deleteIrtCalibrationQueueBatch,
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting IRT calibration attempts...",
    mutation: reset.deleteIrtCalibrationAttemptsBatch,
    resultLabel: "IRT calibration attempts",
  },
  {
    label: "Deleting IRT calibration cache stats...",
    mutation: reset.deleteIrtCalibrationCacheStatsBatch,
    resultLabel: "IRT calibration cache stats",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutation: reset.deleteIrtCalibrationRunsBatch,
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting try-out attempts...",
    mutation: reset.deleteTryoutAttemptsBatch,
    resultLabel: "try-out attempts",
  },
  {
    label: "Deleting try-out entitlements...",
    mutation: reset.deleteTryoutEntitlementsBatch,
    resultLabel: "try-out entitlements",
  },
  {
    label: "Deleting try-out access grants...",
    mutation: reset.deleteTryoutAccessGrantsBatch,
    resultLabel: "try-out access grants",
  },
  {
    label: "Deleting try-out access links...",
    mutation: reset.deleteTryoutAccessLinksBatch,
    resultLabel: "try-out access links",
  },
  {
    label: "Deleting try-out access targets...",
    mutation: reset.deleteTryoutAccessTargetsBatch,
    resultLabel: "try-out access targets",
  },
  {
    label: "Deleting try-out access campaigns...",
    mutation: reset.deleteTryoutAccessCampaignsBatch,
    resultLabel: "try-out access campaigns",
  },
  {
    label: "Deleting try-out content routes...",
    mutation: reset.deleteTryoutContentRoutesBatch,
    resultLabel: "try-out content routes",
  },
  {
    label: "Deleting try-out content search...",
    mutation: reset.deleteTryoutContentSearchBatch,
    resultLabel: "try-out content search rows",
  },
  {
    label: "Deleting try-out route counts...",
    mutation: reset.deleteTryoutContentRouteCountsBatch,
    resultLabel: "try-out route count rows",
  },
  {
    label: "Deleting try-out route pages...",
    mutation: reset.deleteTryoutContentRoutePagesBatch,
    resultLabel: "try-out route page rows",
  },
  {
    label: "Deleting try-out sections...",
    mutation: reset.deleteTryoutSectionsBatch,
    resultLabel: "try-out sections",
  },
  {
    label: "Deleting questions and dependents...",
    mutation: reset.deleteQuestionsWithDependentsBatch,
    resultLabel: "questions",
  },
  {
    label: "Deleting question sets...",
    mutation: reset.deleteQuestionSetsBatch,
    resultLabel: "question sets",
  },
  {
    label: "Deleting try-out sets...",
    mutation: reset.deleteTryoutSetsBatch,
    resultLabel: "try-out sets",
  },
  {
    label: "Deleting try-out tracks...",
    mutation: reset.deleteTryoutTracksBatch,
    resultLabel: "try-out tracks",
  },
  {
    label: "Deleting try-out exams...",
    mutation: reset.deleteTryoutExamsBatch,
    resultLabel: "try-out exams",
  },
  {
    label: "Deleting try-out countries...",
    mutation: reset.deleteTryoutCountriesBatch,
    resultLabel: "try-out countries",
  },
  {
    label: "Deleting IRT scale versions...",
    mutation: reset.deleteIrtScaleVersionsBatch,
    resultLabel: "IRT scale versions",
  },
];

/** Deletes every row reachable by one batch reset mutation. */
const deleteAllBatched = Effect.fn("sync.resetTryouts.deleteAllBatched")(
  function* (
    config: ConvexConfig,
    mutation: BatchDeleteMutation,
    label: string
  ) {
    let totalDeleted = 0;
    let batchNumber = 1;
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

      if (result.deleted === 0) {
        continue;
      }

      yield* Effect.sync(() =>
        process.stdout.write(
          `\r  Batch ${batchNumber}: deleted ${totalDeleted} ${label}...`
        )
      );
      batchNumber += 1;
    }

    if (totalDeleted > 0) {
      yield* Effect.sync(() => process.stdout.write("\n"));
    }

    return totalDeleted;
  }
);

/**
 * Deletes the tryout and IRT content/runtime tables that must be rebuilt from a
 * fresh full sync, then clears incremental sync state.
 */
export const resetTryouts = Effect.fn("sync.resetTryouts")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("=== RESET TRYOUTS + IRT ===\n");
  log(
    "This deletes tryout definitions, access rows, entitlements, catalog metadata, attempts, leaderboard rows, and frozen IRT scale data."
  );
  log(
    "Run a full sync afterward so Convex rebuilds the deleted tryout and IRT content tables coherently.\n"
  );

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning(
      "This will permanently delete tryout, event access, and IRT content/runtime data in production.\n"
    );
  }

  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  const counts = yield* getContentCounts(config);

  log("Current tryout + IRT database contents:\n");
  log(`  Question Sets:          ${counts.questionSets}`);
  log(`  Questions:              ${counts.questions}`);
  log(`  Question Choices:       ${counts.questionChoices}`);
  log(`  Tryout Access Campaigns:${counts.tryoutAccessCampaigns}`);
  log(`  Tryout Access Targets:  ${counts.tryoutAccessTargets}`);
  log(`  Tryout Access Links:    ${counts.tryoutAccessLinks}`);
  log(`  Tryout Access Grants:   ${counts.tryoutAccessGrants}`);
  log(`  Tryout Countries:       ${counts.tryoutCountries}`);
  log(`  Tryout Exams:           ${counts.tryoutExams}`);
  log(`  Tryout Tracks:          ${counts.tryoutTracks}`);
  log(`  Tryout Sets:            ${counts.tryoutSets}`);
  log(`  Tryout Sections:        ${counts.tryoutSections}`);
  log(`  Tryout Entitlements:    ${counts.tryoutEntitlements}`);
  log(`  Tryout Attempts:        ${counts.tryoutAttempts}`);
  log(`  Tryout Section Attempts:${counts.tryoutSectionAttempts}`);
  log(`  Tryout Placements:      ${counts.tryoutAttemptPlacements}`);
  log(`  Tryout Responses:       ${counts.tryoutResponses}`);
  log(`  Tryout Scores:          ${counts.tryoutScores}`);
  log(`  Tryout Leaderboards:    ${counts.tryoutLeaderboardScopes}`);
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

  const totalTryoutAndIrtRows =
    counts.questionSets +
    counts.questions +
    counts.questionChoices +
    counts.tryoutAccessCampaigns +
    counts.tryoutAccessTargets +
    counts.tryoutAccessLinks +
    counts.tryoutAccessGrants +
    counts.tryoutEntitlements +
    counts.tryoutCountries +
    counts.tryoutExams +
    counts.tryoutTracks +
    counts.tryoutSets +
    counts.tryoutSections +
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

  log(`\n  Total tryout + IRT rows: ${totalTryoutAndIrtRows}`);

  if (totalTryoutAndIrtRows === 0 && !options.force) {
    logSuccess("\nTryout and IRT sync-managed data is already empty.");
    yield* clearSyncState(options.prod ?? false);
    log("Cleared sync state file");
    return;
  }

  if (!options.force) {
    log("\nTo delete tryout + IRT data, run:");
    if (options.prod) {
      log("  pnpm --filter @repo/backend sync:prod:reset:tryouts --force");
    } else {
      log("  pnpm --filter @repo/backend sync:reset:tryouts --force");
    }
    return;
  }

  if (totalTryoutAndIrtRows === 0) {
    logWarning(
      "\nNo tryout/IRT source rows found; continuing because --force was passed so stale try-out projections can be cleared."
    );
  }

  log("\nDeleting tryout + IRT data (in dependency order)...\n");
  const startTime = performance.now();
  let totalDeleted = 0;

  for (const [index, step] of RESET_TRYOUT_STEPS.entries()) {
    log(`${index + 1}/${RESET_TRYOUT_STEPS.length} ${step.label}`);
    const deleted = yield* deleteAllBatched(
      config,
      step.mutation,
      step.resultLabel
    );
    logSuccess(`  Deleted ${deleted} ${step.resultLabel}`);
    totalDeleted += deleted;
  }

  log("\n=== RESET TRYOUTS + IRT COMPLETE ===\n");
  logSuccess(
    `Deleted ${totalDeleted} tryout/IRT rows across sync-managed tables`
  );
  log(`Duration: ${formatDuration(performance.now() - startTime)}`);
  yield* clearSyncState(options.prod ?? false);
  log("Cleared sync state file");

  log("\nRun a full sync next:");

  if (options.prod) {
    log("  pnpm --filter @repo/backend sync:prod");
    return;
  }

  log("  pnpm --filter @repo/backend sync");
});
