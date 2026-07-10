import { internal } from "@repo/backend/convex/_generated/api";
import {
  formatDuration,
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import {
  BATCH_SIZES,
  PublicRouteDeleteResultSchema,
  PublicRouteSyncResultSchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { readPublicRouteRows } from "@repo/backend/scripts/sync-content/routes/rows";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "@repo/backend/scripts/sync-content/workflow/metrics";
import { Effect } from "effect";

/** Syncs the source-owned public route read model. */
export const syncPublicRoutes = Effect.fn("sync.publicRoutes")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  const syncedAt = Date.now();
  const rows = yield* readPublicRouteRows();
  const totals: SyncResult = { created: 0, unchanged: 0, updated: 0 };
  const batchSize = BATCH_SIZES.publicRoutes;
  const totalBatches = Math.ceil(rows.length / batchSize);
  const progress = createBatchProgress(rows.length, batchSize);

  if (!options.quiet) {
    log("\n--- PUBLIC ROUTE READ MODEL ---\n");
  }

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const batchNumber = Math.floor(index / batchSize) + 1;

    if (!options.quiet) {
      log(
        formatBatchProgress(progress, batchNumber, totalBatches, batch.length)
      );
    }

    const result = yield* callConvexMutation(
      config,
      internal.contentSync.publicRoutes.internal.bulkSyncPublicRoutes,
      { routes: batch, syncedAt },
      PublicRouteSyncResultSchema
    );

    totals.created += result.created;
    totals.unchanged += result.unchanged;
    totals.updated += result.updated;
    updateBatchProgress(progress, batch.length);
  }

  const deleted = yield* deleteStalePublicRoutes(config, syncedAt);
  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (!options.quiet) {
    log(
      `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
    );
    log(`Deleted stale public routes: ${deleted}`);
    log(
      `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
    );
    logSuccess(`${processed} public route rows synced`);
  }

  return { ...totals, durationMs, itemsPerSecond };
});

/** Deletes stale public route rows in bounded mutations. */
const deleteStalePublicRoutes = Effect.fn("sync.deleteStalePublicRoutes")(
  function* (config: ConvexConfig, syncedAt: number) {
    let deleted = 0;

    while (true) {
      const result = yield* callConvexMutation(
        config,
        internal.contentSync.publicRoutes.internal.deleteStalePublicRoutes,
        { limit: BATCH_SIZES.publicRoutes, syncedAt },
        PublicRouteDeleteResultSchema
      );

      deleted += result.deleted;

      if (result.deleted < BATCH_SIZES.publicRoutes) {
        return deleted;
      }
    }
  }
);
