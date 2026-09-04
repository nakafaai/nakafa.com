import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { pruneArchives } from "@repo/backend/convex/contentRelease/archive/retention";
import {
  CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE,
  runtimeArchiveSweepResultValidator,
} from "@repo/backend/convex/contentRelease/archive/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Clock, Effect } from "effect";

/** Removes expired producer claims and proven canonical archive history. */
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
  return {
    archivesDeleted,
    claimsDeleted: expiredClaims.length,
  };
});

export const sweep = internalMutation({
  args: {},
  returns: runtimeArchiveSweepResultValidator,
  handler: (ctx) => runConvexProgram(sweepProgram(ctx)),
});
