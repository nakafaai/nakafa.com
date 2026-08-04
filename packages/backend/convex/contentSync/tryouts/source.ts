import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { tryoutSyncFail } from "@repo/backend/convex/contentSync/tryouts/error";
import { Effect } from "effect";

/** Reads the active publication owner that routes filesystem sync behavior. */
export const loadTryoutSyncOwnership = Effect.fn(
  "contentSync.tryout.loadOwnership"
)(function* (ctx: QueryCtx) {
  const owner = yield* loadTryoutOwner(ctx);

  return { tryoutsManaged: owner.managed };
});

/** Rejects filesystem synchronization after signed Aksara ownership activates. */
export const requireFilesystemOwner = Effect.fn(
  "contentSync.tryout.requireFilesystemOwner"
)(function* (ctx: QueryCtx) {
  const ownership = yield* loadTryoutSyncOwnership(ctx);

  if (!ownership.tryoutsManaged) {
    return;
  }

  return yield* tryoutSyncFail(
    "TRYOUT_SYNC_MANAGED",
    "Filesystem try-out synchronization is disabled after signed ownership activates."
  );
});
