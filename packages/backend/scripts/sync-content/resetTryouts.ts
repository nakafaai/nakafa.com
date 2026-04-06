import { runConvexMutationGeneric } from "./convexApi";
import { getContentCounts } from "./counts";
import { formatDuration, log, logSuccess, logWarning } from "./logging";
import { clearSyncState } from "./runtime";
import { BatchDeleteResultSchema } from "./schemas";
import type { ConvexConfig, SyncOptions } from "./types";

interface ResetStep {
  label: string;
  mutationPath: string;
  resultLabel: string;
}

const RESET_TRYOUT_STEPS: ResetStep[] = [
  {
    label: "Deleting tryout runtime attempts and answers...",
    mutationPath: "contentSync/mutations/maintenance:deleteTryoutRuntimeBatch",
    resultLabel: "tryout runtime rows",
  },
  {
    label: "Deleting tryout leaderboard entries...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutLeaderboardEntriesBatch",
    resultLabel: "tryout leaderboard entries",
  },
  {
    label: "Deleting user tryout stats...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteUserTryoutStatsBatch",
    resultLabel: "user tryout stats",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScalePublicationQueueBatch",
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale version items...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScaleVersionItemsBatch",
    resultLabel: "IRT scale version items",
  },
  {
    label: "Deleting IRT scale quality checks...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScaleQualityChecksBatch",
    resultLabel: "IRT scale quality checks",
  },
  {
    label: "Deleting IRT scale quality refresh queue...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScaleQualityRefreshQueueBatch",
    resultLabel: "IRT scale quality refresh queue entries",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtCalibrationQueueBatch",
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting IRT calibration attempts...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtCalibrationAttemptsBatch",
    resultLabel: "IRT calibration attempts",
  },
  {
    label: "Deleting IRT calibration cache stats...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtCalibrationCacheStatsBatch",
    resultLabel: "IRT calibration cache stats",
  },
  {
    label: "Deleting exercise item parameters...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteExerciseItemParametersBatch",
    resultLabel: "exercise item parameters",
  },
  {
    label: "Deleting tryout attempts...",
    mutationPath: "contentSync/mutations/maintenance:deleteTryoutAttemptsBatch",
    resultLabel: "tryout attempts",
  },
  {
    label: "Deleting tryout entitlements...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutEntitlementsBatch",
    resultLabel: "tryout entitlements",
  },
  {
    label: "Deleting tryout access grants...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutAccessGrantsBatch",
    resultLabel: "tryout access grants",
  },
  {
    label: "Deleting tryout access campaign products...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutAccessCampaignProductsBatch",
    resultLabel: "tryout access campaign products",
  },
  {
    label: "Deleting tryout access links...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutAccessLinksBatch",
    resultLabel: "tryout access links",
  },
  {
    label: "Deleting tryout access campaigns...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutAccessCampaignsBatch",
    resultLabel: "tryout access campaigns",
  },
  {
    label: "Deleting tryout catalog meta...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutCatalogMetaBatch",
    resultLabel: "tryout catalog meta rows",
  },
  {
    label: "Deleting tryout part sets...",
    mutationPath: "contentSync/mutations/maintenance:deleteTryoutPartSetsBatch",
    resultLabel: "tryout part sets",
  },
  {
    label: "Deleting IRT scale versions...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScaleVersionsBatch",
    resultLabel: "IRT scale versions",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtCalibrationRunsBatch",
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting tryouts...",
    mutationPath: "contentSync/mutations/maintenance:deleteTryoutsBatch",
    resultLabel: "tryouts",
  },
];

/** Deletes every row reachable by one batch maintenance mutation. */
const deleteAllBatched = async (
  config: ConvexConfig,
  mutationPath: string,
  label: string
) => {
  let totalDeleted = 0;
  let batchNumber = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await runConvexMutationGeneric(
      config,
      mutationPath,
      {},
      BatchDeleteResultSchema
    );
    totalDeleted += result.deleted;
    hasMore = result.hasMore;

    if (result.deleted === 0) {
      continue;
    }

    process.stdout.write(
      `\r  Batch ${batchNumber}: deleted ${totalDeleted} ${label}...`
    );
    batchNumber += 1;
  }

  if (totalDeleted > 0) {
    process.stdout.write("\n");
  }

  return totalDeleted;
};

/**
 * Deletes the tryout and IRT content/runtime tables that must be rebuilt from a
 * fresh full sync, then clears incremental sync state.
 */
export const resetTryouts = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> => {
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

  const counts = await getContentCounts(config);

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
    clearSyncState(options.prod ?? false);
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
    const deleted = await deleteAllBatched(
      config,
      step.mutationPath,
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
  clearSyncState(options.prod ?? false);
  log("Cleared sync state file");

  log("\nRun a full sync next:");

  if (options.prod) {
    log("  pnpm --filter @repo/backend sync:prod");
    return;
  }

  log("  pnpm --filter @repo/backend sync");
};
