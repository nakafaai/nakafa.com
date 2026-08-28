import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { deleteAbortMapPage } from "@repo/backend/convex/tryouts/migration/abort/map";
import {
  beginAbort,
  loadAbortState,
  validateAbortFinalState,
  validateAbortProgress,
} from "@repo/backend/convex/tryouts/migration/abort/state";
import { deleteAbortTarget } from "@repo/backend/convex/tryouts/migration/abort/target";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

export const abortResultValidator = v.object({
  deleted: v.number(),
  done: v.boolean(),
  migrationId: v.string(),
});

/** Deletes one bounded page or commits the final retry tombstone. */
export const abortProgram = Effect.fn("tryouts.migration.abort")(function* (
  ctx: MutationCtx,
  migrationId: string
) {
  const state = yield* loadAbortState(ctx, migrationId);
  if (state.kind === "tombstone") {
    return {
      deleted: state.tombstone.deleted,
      done: true,
      migrationId,
    };
  }
  const migration = yield* beginAbort(ctx, state.root);
  const page = yield* deleteAbortMapPage(ctx, migration);
  if (page.deleted > 0) {
    const maps = {
      artifact: migration.abort.maps.artifact + page.maps.artifact,
      catalog: migration.abort.maps.catalog + page.maps.catalog,
      placement: migration.abort.maps.placement + page.maps.placement,
    };
    const deleted = migration.abort.deleted + page.deleted;
    yield* validateAbortProgress(migration, deleted, maps);
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutHistoryMigrations", migration._id, {
        abort: { deleted, maps },
        updatedAt: now,
      })
    );
    return { deleted, done: false, migrationId };
  }
  yield* validateAbortFinalState(ctx, migration);
  const targetDeleted = yield* deleteAbortTarget(ctx, migration);
  const deleted = migration.abort.deleted + targetDeleted + 1;
  yield* validateAbortProgress(migration, deleted, migration.abort.maps);
  const abortedAt = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() =>
    ctx.db.insert("tryoutHistoryMigrationAborts", {
      abortedAt,
      deleted,
      migrationId,
      sourceSnapshotId: migration.sourceSnapshotId,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.delete("tryoutHistoryMigrations", migration._id)
  );
  return { deleted, done: true, migrationId };
});

export const abort = internalMutation({
  args: { migrationId: v.string() },
  returns: abortResultValidator,
  handler: (ctx, args) => runConvexProgram(abortProgram(ctx, args.migrationId)),
});
