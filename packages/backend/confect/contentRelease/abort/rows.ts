import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  ABORT_PAGE_BYTES,
  ABORT_PAGE_LIMIT,
  hasAbortTransactionHeadroom,
} from "@repo/backend/confect/contentRelease/abort/budget";
import { retainOrphanedArtifacts } from "@repo/backend/confect/contentRelease/retention";
import { Effect, Option } from "effect";

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
  contentKey: string,
  artifactLocale: Docs["contentKeys"]["artifactLocale"],
  sequence: number
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const key = yield* database
    .table("contentKeys")
    .get("by_contentKey_and_artifactLocale", contentKey, artifactLocale)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (key?.createdSequence === sequence) {
    yield* writer.table("contentKeys").delete(key._id);
  }
});

/** Removes a route identity only when this release first introduced it. */
const deleteOwnedPath = Effect.fn("contentRelease.deleteAbortPath")(function* (
  appLocale: Docs["contentPaths"]["appLocale"],
  publicPath: string,
  sequence: number
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const path = yield* database
    .table("contentPaths")
    .get("by_appLocale_and_publicPath", appLocale, publicPath)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (path?.createdSequence === sequence) {
    yield* writer.table("contentPaths").delete(path._id);
  }
});

/** Checks whether an aborted release still owns auxiliary publication state. */
export const hasAbortResidue = Effect.fn("contentRelease.hasAbortResidue")(
  function* (sequence: number) {
    const database = yield* DatabaseReader;
    const [key, path] = yield* Effect.all([
      database
        .table("contentKeys")
        .index(
          "by_createdSequence_and_contentKey_and_artifactLocale",
          (query) => query.eq("createdSequence", sequence)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie),
      database
        .table("contentPaths")
        .index("by_createdSequence_and_appLocale_and_publicPath", (query) =>
          query.eq("createdSequence", sequence)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    ]);
    return key !== null || path !== null;
  }
);

/** Stops a deletion page as soon as measured transaction headroom is exhausted. */
const deleteMeasuredPage = Effect.fn("contentRelease.deleteMeasuredAbortPage")(
  function* <Row, R>(
    rows: readonly Row[],
    deleteRow: (row: Row) => Effect.Effect<void, never, R>
  ) {
    const ctx = yield* MutationCtxService;
    let processed = 0;
    for (const row of rows) {
      yield* deleteRow(row);
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

/** Deletes one measured release-owned page and its staged directory identities. */
export const deleteAbortRows = Effect.fn("contentRelease.deleteAbortRows")(
  function* (releaseId: string, sequence: number) {
    const database = yield* DatabaseReader;
    const head = yield* database
      .table("contentHeads")
      .index("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (head) {
      const heads = yield* database
        .table("contentHeads")
        .index("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .paginate({
          cursor: null,
          maximumBytesRead: ABORT_PAGE_BYTES,
          maximumRowsRead: ABORT_PAGE_LIMIT,
          numItems: ABORT_PAGE_LIMIT,
        })
        .pipe(Effect.orDie);
      return yield* deleteMeasuredPage(
        heads.page,
        Effect.fn("contentRelease.deleteAbortHead")(function* (row) {
          const writer = yield* DatabaseWriter;
          yield* writer.table("contentHeads").delete(row._id);
          if (row.artifactHash) {
            yield* retainOrphanedArtifacts([row.artifactHash]);
          }
        })
      );
    }
    const binding = yield* database
      .table("contentBindings")
      .index("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (binding) {
      const bindings = yield* database
        .table("contentBindings")
        .index("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .paginate({
          cursor: null,
          maximumBytesRead: ABORT_PAGE_BYTES,
          maximumRowsRead: ABORT_PAGE_LIMIT,
          numItems: ABORT_PAGE_LIMIT,
        })
        .pipe(Effect.orDie);
      return yield* deleteMeasuredPage(
        bindings.page,
        Effect.fn("contentRelease.deleteAbortBinding")(function* (row) {
          const writer = yield* DatabaseWriter;
          yield* deleteOwnedPath(row.appLocale, row.publicPath, sequence);
          yield* writer.table("contentBindings").delete(row._id);
        })
      );
    }
    const item = yield* database
      .table("contentItems")
      .index("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (item) {
      const items = yield* database
        .table("contentItems")
        .index("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .paginate({
          cursor: null,
          maximumBytesRead: ABORT_PAGE_BYTES,
          maximumRowsRead: ABORT_PAGE_LIMIT,
          numItems: ABORT_PAGE_LIMIT,
        })
        .pipe(Effect.orDie);
      return yield* deleteMeasuredPage(
        items.page,
        Effect.fn("contentRelease.deleteAbortItem")(function* (row) {
          const writer = yield* DatabaseWriter;
          yield* deleteOwnedKey(row.contentKey, row.artifactLocale, sequence);
          yield* writer.table("contentItems").delete(row._id);
          if (row.artifactHash) {
            yield* retainOrphanedArtifacts([row.artifactHash]);
          }
        })
      );
    }
    const batch = yield* database
      .table("snapshotBatches")
      .index("by_releaseId_and_family_and_batchIndex", (query) =>
        query.eq("releaseId", releaseId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!batch) {
      return 0;
    }
    const batches = yield* database
      .table("snapshotBatches")
      .index("by_releaseId_and_family_and_batchIndex", (query) =>
        query.eq("releaseId", releaseId)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: ABORT_PAGE_BYTES,
        maximumRowsRead: ABORT_PAGE_LIMIT,
        numItems: ABORT_PAGE_LIMIT,
      })
      .pipe(Effect.orDie);
    return yield* deleteMeasuredPage(
      batches.page,
      Effect.fn("contentRelease.deleteAbortSnapshotBatch")(function* (row) {
        const writer = yield* DatabaseWriter;
        yield* writer.table("snapshotBatches").delete(row._id);
      })
    );
  }
);
