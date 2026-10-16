import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { MAX_BATCH_STEPS } from "@repo/backend/confect/editor/size";
import { Array as Arr, Effect, HashMap } from "effect";

/**
 * The most bytes one read of steps may take: 512 KiB (ADR 0028 Bounds). The read
 * stops at the row that reaches the budget, so one read may pass it by that row,
 * and a step is at most one batch of `MAX_BATCH_BYTES`.
 */
const STEP_READ_BYTES = 512 * 1024;

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
 * The last step of a document, the one at its head. Its creation time is the time
 * the document last changed, which the snapshot rule reads. A document whose head
 * is above zero has such a step, so a document without one is a defect.
 */
export const lastStepOf = Effect.fn("editor.store.lastStep")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
) {
  const last = yield* (yield* DatabaseReader)
    .table("editorSteps")
    .index(
      "by_documentId_and_version",
      (query) => query.eq("documentId", documentId),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
  return yield* Effect.fromOption(last).pipe(Effect.orDie);
});

/**
 * The steps of a document after one version, in version order. A read takes at
 * most one batch of steps (`MAX_BATCH_STEPS`) and stops at `STEP_READ_BYTES`, so
 * the caller reads on from the last version it received.
 */
export const stepsAfter = Effect.fn("editor.store.stepsAfter")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  version: number
) {
  const page = yield* (yield* DatabaseReader)
    .table("editorSteps")
    .index("by_documentId_and_version", (query) =>
      query.eq("documentId", documentId).gt("version", version)
    )
    .paginate({
      cursor: null,
      maximumBytesRead: STEP_READ_BYTES,
      numItems: MAX_BATCH_STEPS,
    })
    .pipe(Effect.orDie);
  return page.page;
});
