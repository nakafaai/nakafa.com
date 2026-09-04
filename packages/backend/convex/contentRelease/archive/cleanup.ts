import { CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE } from "@repo/backend/content/archive";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { deleteUnreferencedArchiveStorage } from "@repo/backend/convex/contentRelease/archive/model";
import { pruneArchives } from "@repo/backend/convex/contentRelease/archive/retention";
import {
  CONTENT_RUNTIME_ARCHIVE_ORPHAN_GRACE_MS,
  CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
  runtimeArchiveSweepResultValidator,
} from "@repo/backend/convex/contentRelease/archive/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Clock, Effect } from "effect";

/**
 * Advances one bounded storage page and removes only old, unreferenced archive
 * uploads. The persisted cursor spreads metadata reads across cron runs.
 */
const sweepProgram = Effect.fn("contentRuntimeArchive.sweep")(function* (
  ctx: MutationCtx
) {
  const now = yield* Clock.currentTimeMillis;
  const expiredClaims = yield* Effect.promise(() =>
    ctx.db
      .query("contentRuntimeArchiveClaims")
      .withIndex("by_expiresAt", (query) => query.lte("expiresAt", now))
      .take(CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE)
  );
  for (const claim of expiredClaims) {
    yield* Effect.promise(() => ctx.db.delete(claim._id));
  }
  const archivesDeleted = yield* pruneArchives(ctx, now);
  const state = yield* Effect.promise(() =>
    ctx.db.query("contentRuntimeArchiveSweeps").unique()
  );
  const page = yield* Effect.promise(() =>
    ctx.db.system
      .query("_storage")
      .order("asc")
      .paginate({
        cursor: state?.cursor ?? null,
        maximumRowsRead: CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
        numItems: CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
      })
  );
  const cutoff = now - CONTENT_RUNTIME_ARCHIVE_ORPHAN_GRACE_MS;
  let deleted = 0;

  for (const stored of page.page) {
    if (
      stored.contentType !== CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE ||
      stored._creationTime > cutoff
    ) {
      continue;
    }
    if (yield* deleteUnreferencedArchiveStorage(ctx, stored._id)) {
      deleted += 1;
    }
  }

  const cursor = page.isDone ? null : page.continueCursor;
  if (state) {
    yield* Effect.promise(() =>
      ctx.db.patch(state._id, { cursor, updatedAt: now })
    );
  } else {
    yield* Effect.promise(() =>
      ctx.db.insert("contentRuntimeArchiveSweeps", { cursor, updatedAt: now })
    );
  }
  return {
    archivesDeleted,
    claimsDeleted: expiredClaims.length,
    deleted,
    scanned: page.page.length,
  };
});

export const sweep = internalMutation({
  args: {},
  returns: runtimeArchiveSweepResultValidator,
  handler: (ctx) => runConvexProgram(sweepProgram(ctx)),
});
