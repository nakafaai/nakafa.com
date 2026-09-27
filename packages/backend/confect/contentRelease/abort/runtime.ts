import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { readTryoutRuntimeRetention } from "@repo/backend/confect/contentRelease/tryout/runtime";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

const CLEANUP_RUNTIME_LIMIT = 2;
type ReadCtx = MutationCtx | QueryCtx;

/** Loads the bounded permanent rows owned by one release cleanup. */
const loadAbortRuntime = Effect.fn("contentRelease.loadAbortRuntime")(
  function* (ctx: ReadCtx, releaseId: string) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const rows = yield* database
      .table("tryoutRuntimeBundles")
      .index("by_cleanupReleaseId", (query) =>
        query.eq("cleanupReleaseId", releaseId)
      )
      .take(CLEANUP_RUNTIME_LIMIT + 1)
      .pipe(Effect.orDie);
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
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const rows = yield* loadAbortRuntime(ctx, releaseId);
  for (const row of rows) {
    const retention = yield* readTryoutRuntimeRetention(ctx, row, {
      ignoredReleaseId: releaseId,
    });
    const cleanupReleaseId = retention.retainingReleaseId;
    if (cleanupReleaseId) {
      yield* writer
        .table("tryoutRuntimeBundles")
        .patch(row._id, {
          cleanupReleaseId,
        })
        .pipe(Effect.orDie);
      continue;
    }
    if (retention.retainedByAttempt) {
      continue;
    }
    yield* writer.table("tryoutRuntimeBundles").delete(row._id);
  }
});

/** Detects cleanup-owned permanent rows with no durable runtime consumer. */
export const hasAbortRuntime = Effect.fn("contentRelease.hasAbortRuntime")(
  function* (ctx: ReadCtx, releaseId: string) {
    const rows = yield* loadAbortRuntime(ctx, releaseId);
    for (const row of rows) {
      const retention = yield* readTryoutRuntimeRetention(ctx, row, {
        ignoredReleaseId: releaseId,
      });
      if (!retention.retainedByAttempt) {
        return true;
      }
    }
    return false;
  }
);
