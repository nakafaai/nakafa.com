import type { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import {
  formatDuration,
  log,
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/logging";
import { clearSyncState } from "@repo/backend/scripts/sync-content/runtime";
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import { Effect } from "effect";

interface ResetStep {
  label: string;
  mutationRef: Ref.AnyMutation;
  resultLabel: string;
}

const RESET_TRYOUT_STEPS: ResetStep[] = [
  {
    label: "Deleting tryout runtime attempts and answers...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteTryoutRuntimeBatch,
    resultLabel: "tryout runtime rows",
  },
  {
    label: "Deleting tryout leaderboard entries...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutLeaderboardEntriesBatch,
    resultLabel: "tryout leaderboard entries",
  },
  {
    label: "Deleting user tryout stats...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteUserTryoutStatsBatch,
    resultLabel: "user tryout stats",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScalePublicationQueueBatch,
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale version items...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScaleVersionItemsBatch,
    resultLabel: "IRT scale version items",
  },
  {
    label: "Deleting IRT scale quality checks...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScaleQualityChecksBatch,
    resultLabel: "IRT scale quality checks",
  },
  {
    label: "Deleting IRT scale quality refresh queue...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScaleQualityRefreshQueueBatch,
    resultLabel: "IRT scale quality refresh queue entries",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtCalibrationQueueBatch,
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting IRT calibration attempts...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtCalibrationAttemptsBatch,
    resultLabel: "IRT calibration attempts",
  },
  {
    label: "Deleting IRT calibration cache stats...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtCalibrationCacheStatsBatch,
    resultLabel: "IRT calibration cache stats",
  },
  {
    label: "Deleting exercise item parameters...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteExerciseItemParametersBatch,
    resultLabel: "exercise item parameters",
  },
  {
    label: "Deleting tryout attempts...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteTryoutAttemptsBatch,
    resultLabel: "tryout attempts",
  },
  {
    label: "Deleting tryout entitlements...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutEntitlementsBatch,
    resultLabel: "tryout entitlements",
  },
  {
    label: "Deleting tryout access grants...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutAccessGrantsBatch,
    resultLabel: "tryout access grants",
  },
  {
    label: "Deleting tryout access campaign products...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutAccessCampaignProductsBatch,
    resultLabel: "tryout access campaign products",
  },
  {
    label: "Deleting tryout access links...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutAccessLinksBatch,
    resultLabel: "tryout access links",
  },
  {
    label: "Deleting tryout access campaigns...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutAccessCampaignsBatch,
    resultLabel: "tryout access campaigns",
  },
  {
    label: "Deleting tryout catalog meta...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutCatalogMetaBatch,
    resultLabel: "tryout catalog meta rows",
  },
  {
    label: "Deleting tryout part sets...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteTryoutPartSetsBatch,
    resultLabel: "tryout part sets",
  },
  {
    label: "Deleting IRT scale versions...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScaleVersionsBatch,
    resultLabel: "IRT scale versions",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtCalibrationRunsBatch,
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting tryouts...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteTryoutsBatch,
    resultLabel: "tryouts",
  },
];

/** Deletes every row reachable by one batch maintenance mutation. */
const deleteAllBatched = Effect.fn("sync.resetTryouts.deleteAllBatched")(
  function* (
    config: ConvexConfig,
    mutationRef: Ref.AnyMutation,
    label: string
  ) {
    let totalDeleted = 0;
    let batchNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const result = yield* callConvex(
        config,
        "mutation",
        mutationRef,
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
  log(`  Tryout Access Campaigns: ${counts.tryoutAccessCampaigns}`);
  log(`  Tryout Access Products:  ${counts.tryoutAccessCampaignProducts}`);
  log(`  Tryout Access Links:    ${counts.tryoutAccessLinks}`);
  log(`  Tryout Access Grants:   ${counts.tryoutAccessGrants}`);
  log(`  Tryouts:               ${counts.tryouts}`);
  log(`  Tryout Catalog Meta:   ${counts.tryoutCatalogMeta}`);
  log(`  User Entitlements:     ${counts.userTryoutEntitlements}`);
  log(`  Tryout Part Sets:      ${counts.tryoutPartSets}`);
  log(`  Tryout Attempts:       ${counts.tryoutAttempts}`);
  log(`  Tryout Part Attempts:  ${counts.tryoutPartAttempts}`);
  log(`  Tryout Leaderboard:    ${counts.tryoutLeaderboardEntries}`);
  log(`  User Tryout Stats:     ${counts.userTryoutStats}`);
  log(`  IRT Calibration Queue: ${counts.irtCalibrationQueue}`);
  log(`  IRT Calibration Rows:  ${counts.irtCalibrationAttempts}`);
  log(`  IRT Cache Stats:       ${counts.irtCalibrationCacheStats}`);
  log(`  IRT Calibration Runs:  ${counts.irtCalibrationRuns}`);
  log(`  IRT Scale Quality:     ${counts.irtScaleQualityChecks}`);
  log(`  IRT Scale Quality Q:   ${counts.irtScaleQualityRefreshQueue}`);
  log(`  IRT Item Params:       ${counts.exerciseItemParameters}`);
  log(`  IRT Scale Queue:       ${counts.irtScalePublicationQueue}`);
  log(`  IRT Scale Versions:    ${counts.irtScaleVersions}`);
  log(`  IRT Scale Items:       ${counts.irtScaleVersionItems}`);

  const totalTryoutAndIrtRows =
    counts.tryoutAccessCampaigns +
    counts.tryoutAccessCampaignProducts +
    counts.tryoutAccessLinks +
    counts.tryoutAccessGrants +
    counts.userTryoutEntitlements +
    counts.tryouts +
    counts.tryoutCatalogMeta +
    counts.tryoutPartSets +
    counts.tryoutAttempts +
    counts.tryoutPartAttempts +
    counts.tryoutLeaderboardEntries +
    counts.userTryoutStats +
    counts.irtCalibrationQueue +
    counts.irtCalibrationAttempts +
    counts.irtCalibrationCacheStats +
    counts.irtCalibrationRuns +
    counts.irtScaleQualityChecks +
    counts.irtScaleQualityRefreshQueue +
    counts.exerciseItemParameters +
    counts.irtScalePublicationQueue +
    counts.irtScaleVersions +
    counts.irtScaleVersionItems;

  log(`\n  Total tryout + IRT rows: ${totalTryoutAndIrtRows}`);

  if (totalTryoutAndIrtRows === 0) {
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

  log("\nDeleting tryout + IRT data (in dependency order)...\n");
  const startTime = performance.now();
  let totalDeleted = 0;

  for (const [index, step] of RESET_TRYOUT_STEPS.entries()) {
    log(`${index + 1}/${RESET_TRYOUT_STEPS.length} ${step.label}`);
    const deleted = yield* deleteAllBatched(
      config,
      step.mutationRef,
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
