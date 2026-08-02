import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { tryoutSyncFail } from "@repo/backend/convex/contentSync/tryouts/error";
import { Effect } from "effect";

/** Rejects filesystem synchronization after signed Aksara ownership activates. */
export const requireFilesystemOwner = Effect.fn(
  "contentSync.tryout.requireFilesystemOwner"
)(function* (ctx: QueryCtx) {
  const owner = yield* loadTryoutOwner(ctx);

  if (!owner.managed) {
    return;
  }

  return yield* tryoutSyncFail(
    "TRYOUT_SYNC_MANAGED",
    "Filesystem try-out synchronization is disabled after signed ownership activates."
  );
});
