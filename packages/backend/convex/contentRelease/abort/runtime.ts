import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readTryoutRuntimeRetention } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { Effect } from "effect";

const CLEANUP_RUNTIME_LIMIT = 2;

type ReadCtx = MutationCtx | QueryCtx;

/** Loads the bounded permanent rows owned by one release cleanup. */
const loadAbortRuntime = Effect.fn("contentRelease.loadAbortRuntime")(
  function* (ctx: ReadCtx, releaseId: string) {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutRuntimeBundles")
        .withIndex("by_cleanupReleaseId", (query) =>
          query.eq("cleanupReleaseId", releaseId)
        )
        .take(CLEANUP_RUNTIME_LIMIT + 1)
    );
    if (rows.length > CLEANUP_RUNTIME_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} exceeded its permanent runtime pair bound.`
      );
    }
    return rows;
  }
);

/** Removes only permanent rows with no attempt or state-owned consumer. */
export const deleteAbortRuntime = Effect.fn(
  "contentRelease.deleteAbortRuntime"
)(function* (ctx: MutationCtx, releaseId: string) {
  const rows = yield* loadAbortRuntime(ctx, releaseId);
  for (const row of rows) {
    const retention = yield* readTryoutRuntimeRetention(ctx, row, releaseId);
    if (retention.retainingReleaseId) {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutRuntimeBundles", row._id, {
          cleanupReleaseId: retention.retainingReleaseId,
        })
      );
      continue;
    }
    if (retention.durable || retention.migration) {
      continue;
    }
    yield* Effect.promise(() => ctx.db.delete("tryoutRuntimeBundles", row._id));
  }
});

/** Detects cleanup-owned permanent rows with no durable runtime consumer. */
export const hasAbortRuntime = Effect.fn("contentRelease.hasAbortRuntime")(
  function* (ctx: ReadCtx, releaseId: string) {
    const rows = yield* loadAbortRuntime(ctx, releaseId);
    for (const row of rows) {
      const retention = yield* readTryoutRuntimeRetention(ctx, row, releaseId);
      if (!retention.durable) {
        return true;
      }
    }
    return false;
  }
);
