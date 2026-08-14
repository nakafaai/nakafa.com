import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  ABORT_PAGE_BYTES,
  ABORT_PAGE_LIMIT,
  hasAbortTransactionHeadroom,
} from "@repo/backend/convex/contentRelease/abort/budget";
import { retainOrphanedArtifacts } from "@repo/backend/convex/contentRelease/retention";
import { Effect } from "effect";

interface AbortCounts {
  readonly checkedItems: number;
  readonly stagedItems: number;
  readonly stagedRoutes: number;
  readonly stagedSnapshotBatches: number;
}

/** Counts durable release-owned rows processed by an abort. */
export function abortRowCount(release: AbortCounts) {
  return (
    release.checkedItems +
    release.stagedItems +
    release.stagedRoutes +
    release.stagedSnapshotBatches
  );
}

/** Removes a directory key only when this release created its identity. */
const deleteOwnedKey = Effect.fn("contentRelease.deleteAbortKey")(function* (
  ctx: MutationCtx,
  contentKey: string,
  artifactLocale: Doc<"contentKeys">["artifactLocale"],
  sequence: number
) {
  const key = yield* Effect.promise(() =>
    ctx.db
      .query("contentKeys")
      .withIndex("by_contentKey_and_artifactLocale", (query) =>
        query.eq("contentKey", contentKey).eq("artifactLocale", artifactLocale)
      )
      .unique()
  );
  if (key?.createdSequence === sequence) {
    yield* Effect.promise(() => ctx.db.delete("contentKeys", key._id));
  }
});

/** Removes a route identity only when this release first introduced it. */
const deleteOwnedPath = Effect.fn("contentRelease.deleteAbortPath")(function* (
  ctx: MutationCtx,
  appLocale: Doc<"contentPaths">["appLocale"],
  publicPath: string,
  sequence: number
) {
  const path = yield* Effect.promise(() =>
    ctx.db
      .query("contentPaths")
      .withIndex("by_appLocale_and_publicPath", (query) =>
        query.eq("appLocale", appLocale).eq("publicPath", publicPath)
      )
      .unique()
  );
  if (path?.createdSequence === sequence) {
    yield* Effect.promise(() => ctx.db.delete("contentPaths", path._id));
  }
});

/** Checks whether an aborted release still owns auxiliary publication state. */
export const hasAbortResidue = Effect.fn("contentRelease.hasAbortResidue")(
  function* (ctx: MutationCtx | QueryCtx, sequence: number) {
    const [key, path] = yield* Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("contentKeys")
          .withIndex(
            "by_createdSequence_and_contentKey_and_artifactLocale",
            (query) => query.eq("createdSequence", sequence)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("contentPaths")
          .withIndex(
            "by_createdSequence_and_appLocale_and_publicPath",
            (query) => query.eq("createdSequence", sequence)
          )
          .first()
      ),
    ]);
    return key !== null || path !== null;
  }
);

/** Deletes one measured release-owned page and its staged directory identities. */
export const deleteAbortRows = Effect.fn("contentRelease.deleteAbortRows")(
  function* (ctx: MutationCtx, releaseId: string, sequence: number) {
    const head = yield* Effect.promise(() =>
      ctx.db
        .query("contentHeads")
        .withIndex("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .first()
    );
    if (head) {
      const heads = yield* Effect.promise(() =>
        ctx.db
          .query("contentHeads")
          .withIndex("by_releaseId_and_index", (query) =>
            query.eq("releaseId", releaseId)
          )
          .paginate({
            cursor: null,
            maximumBytesRead: ABORT_PAGE_BYTES,
            maximumRowsRead: ABORT_PAGE_LIMIT,
            numItems: ABORT_PAGE_LIMIT,
          })
      );
      let processed = 0;
      for (const row of heads.page) {
        yield* Effect.promise(() => ctx.db.delete("contentHeads", row._id));
        if (row.artifactHash) {
          yield* retainOrphanedArtifacts(ctx, [row.artifactHash]);
        }
        processed += 1;
        const metrics = yield* Effect.promise(() =>
          ctx.meta.getTransactionMetrics()
        );
        if (!hasAbortTransactionHeadroom(metrics)) {
          return processed;
        }
      }
      return processed;
    }

    const binding = yield* Effect.promise(() =>
      ctx.db
        .query("contentBindings")
        .withIndex("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .first()
    );
    if (binding) {
      const bindings = yield* Effect.promise(() =>
        ctx.db
          .query("contentBindings")
          .withIndex("by_releaseId_and_index", (query) =>
            query.eq("releaseId", releaseId)
          )
          .paginate({
            cursor: null,
            maximumBytesRead: ABORT_PAGE_BYTES,
            maximumRowsRead: ABORT_PAGE_LIMIT,
            numItems: ABORT_PAGE_LIMIT,
          })
      );
      let processed = 0;
      for (const row of bindings.page) {
        yield* deleteOwnedPath(ctx, row.appLocale, row.publicPath, sequence);
        yield* Effect.promise(() => ctx.db.delete("contentBindings", row._id));
        processed += 1;
        const metrics = yield* Effect.promise(() =>
          ctx.meta.getTransactionMetrics()
        );
        if (!hasAbortTransactionHeadroom(metrics)) {
          return processed;
        }
      }
      return processed;
    }

    const item = yield* Effect.promise(() =>
      ctx.db
        .query("contentItems")
        .withIndex("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .first()
    );
    if (item) {
      const items = yield* Effect.promise(() =>
        ctx.db
          .query("contentItems")
          .withIndex("by_releaseId_and_index", (query) =>
            query.eq("releaseId", releaseId)
          )
          .paginate({
            cursor: null,
            maximumBytesRead: ABORT_PAGE_BYTES,
            maximumRowsRead: ABORT_PAGE_LIMIT,
            numItems: ABORT_PAGE_LIMIT,
          })
      );
      let processed = 0;
      for (const row of items.page) {
        yield* deleteOwnedKey(
          ctx,
          row.contentKey,
          row.artifactLocale,
          sequence
        );
        yield* Effect.promise(() => ctx.db.delete("contentItems", row._id));
        if (row.artifactHash) {
          yield* retainOrphanedArtifacts(ctx, [row.artifactHash]);
        }
        processed += 1;
        const metrics = yield* Effect.promise(() =>
          ctx.meta.getTransactionMetrics()
        );
        if (!hasAbortTransactionHeadroom(metrics)) {
          return processed;
        }
      }
      return processed;
    }

    const batch = yield* Effect.promise(() =>
      ctx.db
        .query("snapshotBatches")
        .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
          query.eq("releaseId", releaseId)
        )
        .first()
    );
    if (!batch) {
      return 0;
    }
    const batches = yield* Effect.promise(() =>
      ctx.db
        .query("snapshotBatches")
        .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
          query.eq("releaseId", releaseId)
        )
        .paginate({
          cursor: null,
          maximumBytesRead: ABORT_PAGE_BYTES,
          maximumRowsRead: ABORT_PAGE_LIMIT,
          numItems: ABORT_PAGE_LIMIT,
        })
    );
    let processed = 0;
    for (const row of batches.page) {
      yield* Effect.promise(() => ctx.db.delete("snapshotBatches", row._id));
      processed += 1;
      const metrics = yield* Effect.promise(() =>
        ctx.meta.getTransactionMetrics()
      );
      if (!hasAbortTransactionHeadroom(metrics)) {
        return processed;
      }
    }
    return processed;
  }
);
