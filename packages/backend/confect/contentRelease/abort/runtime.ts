import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { readTryoutRuntimeRetention } from "@repo/backend/confect/contentRelease/tryout/runtime";
import { Effect } from "effect";

const CLEANUP_RUNTIME_LIMIT = 2;

/** Loads the bounded permanent rows owned by one release cleanup. */
const loadAbortRuntime = Effect.fn("contentRelease.loadAbortRuntime")(
  function* (releaseId: string) {
    const database = yield* DatabaseReader;
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
)(function* (releaseId: string) {
  const writer = yield* DatabaseWriter;
  const rows = yield* loadAbortRuntime(releaseId);
  for (const row of rows) {
    const retention = yield* readTryoutRuntimeRetention(row, {
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
  function* (releaseId: string) {
    const rows = yield* loadAbortRuntime(releaseId);
    for (const row of rows) {
      const retention = yield* readTryoutRuntimeRetention(row, {
        ignoredReleaseId: releaseId,
      });
      if (!retention.retainedByAttempt) {
        return true;
      }
    }
    return false;
  }
);
