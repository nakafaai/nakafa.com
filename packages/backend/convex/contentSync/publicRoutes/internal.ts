import { internalQuery } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  deleteOlderPublicSitemapPages,
  getPublicSitemapCountState,
  savePublicSitemapCount,
  syncPublicSitemapPages,
} from "@repo/backend/convex/contentSync/publicRoutes/artifacts";
import {
  getPublicRouteRootState,
  listPublicRouteShardStates,
  savePublicRouteRootState,
  syncPublicRouteShards,
} from "@repo/backend/convex/contentSync/publicRoutes/impl";
import {
  publicRouteShardValidator,
  publicRouteSyncResultValidator,
  publicRouteSyncStatePageValidator,
  publicRouteSyncStateReturnValidator,
} from "@repo/backend/convex/contentSync/publicRoutes/spec";
import {
  publicRouteSitemapCountReturnValidator,
  publicRouteSitemapCountValidator,
  publicRouteSitemapPageValidator,
  publicSitemapDeleteResultValidator,
  publicSitemapSyncResultValidator,
} from "@repo/backend/convex/contents/sitemap/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

/** Returns the root source projection hash for the no-op sync path. */
export const getRootState = internalQuery({
  args: {},
  returns: publicRouteSyncStateReturnValidator,
  handler: (ctx) => runConvexProgram(getPublicRouteRootState(ctx)),
});

/** Returns one bounded page of non-root route shard hashes. */
export const listShardStates = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: publicRouteSyncStatePageValidator,
  handler: (ctx, args) =>
    runConvexProgram(listPublicRouteShardStates(ctx, args.paginationOpts)),
});

/** Applies bounded source route shards and reconciles stale rows per shard. */
export const syncShards = internalMutation({
  args: { shards: v.array(publicRouteShardValidator) },
  returns: publicRouteSyncResultValidator,
  handler: (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "syncShards",
      limit: CONTENT_SYNC_BATCH_LIMITS.publicRouteShards,
      received: args.shards.length,
      unit: "public route shards",
    });
    assertContentSyncBatchSize({
      functionName: "syncShards",
      limit: CONTENT_SYNC_BATCH_LIMITS.publicRouteRows,
      received: args.shards.reduce(
        (total, shard) => total + shard.routes.length,
        0
      ),
      unit: "public routes",
    });

    return runConvexProgram(syncPublicRouteShards(ctx, args.shards));
  },
});

/** Commits the root source projection hash after changed shards succeed. */
export const saveRootState = internalMutation({
  args: { hash: v.string(), rowCount: v.number() },
  returns: v.null(),
  handler: (ctx, args) =>
    runConvexProgram(savePublicRouteRootState(ctx, args.hash, args.rowCount)),
});

/** Reads one locale's committed public sitemap count state. */
export const getSitemapCountState = internalQuery({
  args: { locale: localeValidator },
  returns: publicRouteSitemapCountReturnValidator,
  handler: (ctx, args) =>
    runConvexProgram(getPublicSitemapCountState(ctx, args.locale)),
});

/** Writes one bounded batch of immutable public sitemap artifact pages. */
export const syncSitemapPages = internalMutation({
  args: { pages: v.array(publicRouteSitemapPageValidator) },
  returns: publicSitemapSyncResultValidator,
  handler: (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "syncSitemapPages",
      limit: CONTENT_SYNC_BATCH_LIMITS.publicSitemapPages,
      received: args.pages.length,
      unit: "public sitemap pages",
    });

    return runConvexProgram(syncPublicSitemapPages(ctx, args.pages));
  },
});

/** Deletes one bounded batch of pages older than a committed generation. */
export const deleteOlderSitemapPages = internalMutation({
  args: {
    committedSyncedAt: v.number(),
    locale: localeValidator,
  },
  returns: publicSitemapDeleteResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(deleteOlderPublicSitemapPages(ctx, args)),
});

/** Commits a locale count after all of its public sitemap pages are ready. */
export const saveSitemapCount = internalMutation({
  args: publicRouteSitemapCountValidator.fields,
  returns: publicSitemapSyncResultValidator,
  handler: (ctx, args) => runConvexProgram(savePublicSitemapCount(ctx, args)),
});
