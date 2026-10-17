import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { STEP_READ_BYTES } from "@repo/backend/confect/editor/size";
import { Array as Arr, Effect, HashMap } from "effect";

/**
 * The snapshot of a document, its one row. A document gets its snapshot in the
 * transaction that creates it, so a document without one is a defect.
 */
export const snapshotOf = Effect.fn("editor.store.snapshot")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
) {
  return yield* (yield* DatabaseReader)
    .table("editorSnapshots")
    .get("by_documentId", documentId)
    .pipe(Effect.orDie);
});

/**
 * The snapshot version of each document in the list, read from the small document
 * rows. The sweep reads this instead of the snapshot rows, which hold a whole
 * document each (ADR 0028 Bounds).
 */
export const snapshotVersionsOf = Effect.fn("editor.store.snapshotVersions")(
  function* (documentIds: readonly GenericId.GenericId<"editorDocuments">[]) {
    const reader = yield* DatabaseReader;
    const rows = yield* Effect.forEach(documentIds, (documentId) =>
      reader.table("editorDocuments").get(documentId).pipe(Effect.orDie)
    );
    return HashMap.fromIterable(
      Arr.zip(
        documentIds,
        Arr.map(rows, (row) => row.snapshotVersion)
      )
    );
  }
);

/**
 * The record of one editor session on a document, if the session has had a batch
 * accepted. The caller decides who may read it: `open` and `since` answer only the
 * session's own author.
 */
export const clientRecordOf = Effect.fn("editor.store.client")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  clientId: string
) {
  return yield* (yield* DatabaseReader)
    .table("editorClients")
    .index("by_documentId_and_clientId", (query) =>
      query.eq("documentId", documentId).eq("clientId", clientId)
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * The steps of a document after one version, in version order: at most `numItems` steps,
 * and at most `STEP_READ_BYTES`. The caller reads on from the last version it received. A
 * transaction may paginate only once, so a caller reads one page.
 */
export const stepsAfter = Effect.fn("editor.store.stepsAfter")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  version: number,
  numItems: number
) {
  const page = yield* (yield* DatabaseReader)
    .table("editorSteps")
    .index("by_documentId_and_version", (query) =>
      query.eq("documentId", documentId).gt("version", version)
    )
    .paginate({
      cursor: null,
      maximumBytesRead: STEP_READ_BYTES,
      numItems,
    })
    .pipe(Effect.orDie);
  return page.page;
});

/**
 * Every step after one version up to the head, in one read. A transaction may paginate
 * only once (Convex's limit for `.paginate()`), so a fold takes its backlog with `take`. The
 * backlog is one read of `stepsAfter` plus one batch, because a submit refuses a backlog
 * that one read does not hold (`pendingRows`), so the read stays within the bounds of a
 * transaction (ADR 0028 Bounds).
 */
export const stepsThrough = Effect.fn("editor.store.stepsThrough")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  version: number,
  head: number
) {
  return yield* (yield* DatabaseReader)
    .table("editorSteps")
    .index("by_documentId_and_version", (query) =>
      query.eq("documentId", documentId).gt("version", version)
    )
    .take(head - version)
    .pipe(Effect.orDie);
});
