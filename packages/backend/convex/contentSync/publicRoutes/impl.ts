import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  PUBLIC_ROUTE_ROOT_SHARD,
  PUBLIC_ROUTE_SHARD_COUNT,
  type PublicRouteShard,
  type PublicRouteSyncRow,
} from "@repo/backend/convex/contentSync/publicRoutes/spec";
import type { PaginationOptions } from "convex/server";
import { Effect, Schema } from "effect";

class PublicRouteShardError extends Schema.TaggedError<PublicRouteShardError>()(
  "PublicRouteShardError",
  {
    code: Schema.Literal("PUBLIC_ROUTE_SHARD_INVALID"),
    message: Schema.String,
  }
) {}

interface SyncTotals {
  created: number;
  deleted: number;
  unchanged: number;
  updated: number;
}

/** Applies changed public route shards without touching stable shards. */
export const syncPublicRouteShards = Effect.fn(
  "contentSync.publicRoutes.syncShards"
)(function* (ctx: MutationCtx, shards: PublicRouteShard[]) {
  const totals: SyncTotals = {
    created: 0,
    deleted: 0,
    unchanged: 0,
    updated: 0,
  };

  for (const shard of shards) {
    yield* validateShard(shard.shard);
    const storedRoutes = yield* Effect.promise(() =>
      ctx.db
        .query("publicRoutes")
        .withIndex("by_syncShard", (query) =>
          query.eq("syncShard", shard.shard)
        )
        .collect()
    );
    const remainingRoutes = new Map(
      storedRoutes.map((route) => [getRouteIdentity(route), route])
    );

    for (const route of shard.routes) {
      const identity = getRouteIdentity(route);
      const existing = remainingRoutes.get(identity);
      const storedRoute = { ...route, syncShard: shard.shard };

      remainingRoutes.delete(identity);

      if (existing?.contentHash === route.contentHash) {
        totals.unchanged++;
        continue;
      }

      if (existing) {
        yield* Effect.promise(() =>
          ctx.db.replace("publicRoutes", existing._id, storedRoute)
        );
        totals.updated++;
        continue;
      }

      yield* Effect.promise(() => ctx.db.insert("publicRoutes", storedRoute));
      totals.created++;
    }

    for (const staleRoute of remainingRoutes.values()) {
      yield* Effect.promise(() =>
        ctx.db.delete("publicRoutes", staleRoute._id)
      );
      totals.deleted++;
    }

    yield* saveShardState(ctx, shard);
  }

  return totals;
});

/** Reads the root projection hash used by the constant-time no-op path. */
export const getPublicRouteRootState = Effect.fn(
  "contentSync.publicRoutes.getRootState"
)(function* (ctx: QueryCtx) {
  const state = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSyncState")
      .withIndex("by_shard", (query) =>
        query.eq("shard", PUBLIC_ROUTE_ROOT_SHARD)
      )
      .unique()
  );

  return state ? toSyncState(state) : null;
});

/** Reads one bounded page of non-root route shard hashes. */
export const listPublicRouteShardStates = Effect.fn(
  "contentSync.publicRoutes.listShardStates"
)(function* (ctx: QueryCtx, paginationOpts: PaginationOptions) {
  const result = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSyncState")
      .withIndex("by_shard", (query) => query.gte("shard", 0))
      .paginate(paginationOpts)
  );

  return {
    continueCursor: result.continueCursor,
    isDone: result.isDone,
    page: result.page.map(toSyncState),
  };
});

/** Saves the root projection hash only after all changed shards succeed. */
export const savePublicRouteRootState = Effect.fn(
  "contentSync.publicRoutes.saveRootState"
)(function* (ctx: MutationCtx, hash: string, rowCount: number) {
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSyncState")
      .withIndex("by_shard", (query) =>
        query.eq("shard", PUBLIC_ROUTE_ROOT_SHARD)
      )
      .unique()
  );
  const state = { hash, rowCount, shard: PUBLIC_ROUTE_ROOT_SHARD };

  if (existing) {
    yield* Effect.promise(() =>
      ctx.db.replace("publicRouteSyncState", existing._id, state)
    );
    return null;
  }

  yield* Effect.promise(() => ctx.db.insert("publicRouteSyncState", state));
  return null;
});

/** Persists one non-empty shard hash or removes the state for an empty shard. */
const saveShardState = Effect.fn("contentSync.publicRoutes.saveShardState")(
  function* (ctx: MutationCtx, shard: PublicRouteShard) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("publicRouteSyncState")
        .withIndex("by_shard", (query) => query.eq("shard", shard.shard))
        .unique()
    );

    if (shard.routes.length === 0) {
      if (existing) {
        yield* Effect.promise(() =>
          ctx.db.delete("publicRouteSyncState", existing._id)
        );
      }
      return;
    }

    const state = {
      hash: shard.hash,
      rowCount: shard.routes.length,
      shard: shard.shard,
    };

    if (existing) {
      yield* Effect.promise(() =>
        ctx.db.replace("publicRouteSyncState", existing._id, state)
      );
      return;
    }

    yield* Effect.promise(() => ctx.db.insert("publicRouteSyncState", state));
  }
);

/** Rejects invalid shard numbers before any route rows are read or written. */
function validateShard(shard: number) {
  if (
    Number.isInteger(shard) &&
    shard >= 0 &&
    shard < PUBLIC_ROUTE_SHARD_COUNT
  ) {
    return Effect.void;
  }

  return Effect.fail(
    new PublicRouteShardError({
      code: "PUBLIC_ROUTE_SHARD_INVALID",
      message: `Public route shard ${shard} is outside 0-${PUBLIC_ROUTE_SHARD_COUNT - 1}.`,
    })
  );
}

/** Builds a collision-safe identity from one locale and public route path. */
function getRouteIdentity(route: PublicRouteSyncRow) {
  return JSON.stringify([route.locale, route.publicPath]);
}

/** Removes Convex system fields from one persisted sync state row. */
function toSyncState(state: { hash: string; rowCount: number; shard: number }) {
  return {
    hash: state.hash,
    rowCount: state.rowCount,
    shard: state.shard,
  };
}
