import { internal } from "@repo/backend/convex/_generated/api";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  formatDuration,
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import {
  PublicRouteRootStateSchema,
  PublicRouteSyncResultSchema,
  PublicRouteSyncStatePageSchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import {
  callConvexMutation,
  callConvexQuery,
} from "@repo/backend/scripts/sync-content/convex/client";
import {
  type PublicRouteProjection,
  readPublicRouteProjection,
} from "@repo/backend/scripts/sync-content/routes/rows";
import { syncPublicSitemapArtifacts } from "@repo/backend/scripts/sync-content/routes/sitemap";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

type SyncShardsArgs = FunctionArgs<
  typeof internal.contentSync.publicRoutes.internal.syncShards
>;
type PublicRouteShard = SyncShardsArgs["shards"][number];
type PublicRouteSyncState = FunctionReturnType<
  typeof internal.contentSync.publicRoutes.internal.listShardStates
>["page"][number];

const STATE_PAGE_SIZE = 1000;

class PublicRouteShardOverflowError extends Schema.TaggedError<PublicRouteShardOverflowError>()(
  "PublicRouteShardOverflowError",
  { message: Schema.String }
) {}

/** Syncs only changed public route shards and skips stable projections. */
export const syncPublicRoutes = Effect.fn("sync.publicRoutes")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  const projection = yield* readPublicRouteProjection();
  const rootState = yield* callConvexQuery(
    config,
    internal.contentSync.publicRoutes.internal.getRootState,
    {},
    PublicRouteRootStateSchema
  );

  if (
    rootState?.hash === projection.hash &&
    rootState.rowCount === projection.rowCount
  ) {
    yield* syncPublicSitemapArtifacts(config, projection);

    return finishSync(
      { created: 0, unchanged: projection.rowCount, updated: 0 },
      0,
      startTime,
      options
    );
  }

  const storedStates = yield* readShardStates(config);
  const changedShards = getChangedShards(projection, storedStates);
  const batches = yield* buildShardBatches(changedShards);
  const totals = { created: 0, deleted: 0, unchanged: 0, updated: 0 };

  if (!options.quiet) {
    log("\n--- PUBLIC ROUTES ---\n");
    log(
      `Projection: ${projection.rowCount} rows, ${changedShards.length}/${projection.shards.length} shards changed`
    );
  }

  for (const shards of batches) {
    const result = yield* callConvexMutation(
      config,
      internal.contentSync.publicRoutes.internal.syncShards,
      { shards },
      PublicRouteSyncResultSchema
    );

    totals.created += result.created;
    totals.deleted += result.deleted;
    totals.unchanged += result.unchanged;
    totals.updated += result.updated;
  }

  yield* syncPublicSitemapArtifacts(config, projection);
  yield* callConvexMutation(
    config,
    internal.contentSync.publicRoutes.internal.saveRootState,
    { hash: projection.hash, rowCount: projection.rowCount },
    Schema.Null
  );

  const result: SyncResult = {
    created: totals.created,
    unchanged: projection.rowCount - totals.created - totals.updated,
    updated: totals.updated,
  };

  return finishSync(result, totals.deleted, startTime, options);
});

/** Reads all compact shard states through bounded Convex pagination. */
const readShardStates = Effect.fn("sync.readPublicRouteShardStates")(function* (
  config: ConvexConfig
) {
  const states: PublicRouteSyncState[] = [];
  let cursor: string | null = null;
  let isDone = false;

  while (!isDone) {
    const page: FunctionReturnType<
      typeof internal.contentSync.publicRoutes.internal.listShardStates
    > = yield* callConvexQuery(
      config,
      internal.contentSync.publicRoutes.internal.listShardStates,
      { paginationOpts: { cursor, numItems: STATE_PAGE_SIZE } },
      PublicRouteSyncStatePageSchema
    );

    states.push(...page.page);
    cursor = page.continueCursor;
    isDone = page.isDone;
  }

  return states;
});

/** Selects source shards whose hash/count differs plus removed stored shards. */
function getChangedShards(
  projection: PublicRouteProjection,
  storedStates: PublicRouteSyncState[]
) {
  const expectedShards = new Map(
    projection.shards.map((shard) => [shard.shard, shard])
  );
  const storedByShard = new Map(
    storedStates.map((state) => [state.shard, state])
  );
  const changed = projection.shards.filter((shard) => {
    const stored = storedByShard.get(shard.shard);
    return (
      stored?.hash !== shard.hash || stored.rowCount !== shard.routes.length
    );
  });

  for (const state of storedStates) {
    if (!expectedShards.has(state.shard)) {
      changed.push({ hash: "", routes: [], shard: state.shard });
    }
  }

  return changed.sort((left, right) => left.shard - right.shard);
}

/** Packs changed shards into mutations bounded by row and shard limits. */
const buildShardBatches = Effect.fn("sync.buildPublicRouteShardBatches")(
  function* (shards: PublicRouteShard[]) {
    const batches: PublicRouteShard[][] = [];
    let batch: PublicRouteShard[] = [];
    let rowCount = 0;

    for (const shard of shards) {
      if (shard.routes.length > CONTENT_SYNC_BATCH_LIMITS.publicRouteRows) {
        return yield* Effect.fail(
          new PublicRouteShardOverflowError({
            message: `Public route shard ${shard.shard} has ${shard.routes.length} rows; limit is ${CONTENT_SYNC_BATCH_LIMITS.publicRouteRows}.`,
          })
        );
      }

      const exceedsRows =
        rowCount + shard.routes.length >
        CONTENT_SYNC_BATCH_LIMITS.publicRouteRows;
      const exceedsShards =
        batch.length >= CONTENT_SYNC_BATCH_LIMITS.publicRouteShards;

      if (batch.length > 0 && (exceedsRows || exceedsShards)) {
        batches.push(batch);
        batch = [];
        rowCount = 0;
      }

      batch.push(shard);
      rowCount += shard.routes.length;
    }

    if (batch.length > 0) {
      batches.push(batch);
    }

    return batches;
  }
);

/** Logs and returns one normalized public route sync result. */
function finishSync(
  result: SyncResult,
  deleted: number,
  startTime: number,
  options: SyncOptions
) {
  const durationMs = performance.now() - startTime;
  const processed = result.created + result.updated + result.unchanged;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (!options.quiet) {
    log(
      `Result: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged, ${deleted} deleted`
    );
    log(
      `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
    );
    logSuccess(`${processed} public route rows reconciled`);
  }

  return { ...result, durationMs, itemsPerSecond };
}
