import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { MAX_BATCH_STEPS } from "@repo/backend/confect/editor/size";
import { snapshotOf } from "@repo/backend/confect/editor/store";
import { Array as Arr, Effect } from "effect";

/**
 * Deletes the steps of one document, one read's worth at a time, until none is left.
 * Each read takes the first steps of the document in version order, and a step that
 * this transaction deleted is not read again, so the loop ends.
 */
const deleteSteps = Effect.fn("editor.document.deleteSteps")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
): Effect.fn.Return<void, never, DatabaseReader | DatabaseWriter> {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const steps = yield* reader
    .table("editorSteps")
    .index("by_documentId_and_version", (query) =>
      query.eq("documentId", documentId)
    )
    .take(MAX_BATCH_STEPS)
    .pipe(Effect.orDie);
  if (Arr.isReadonlyArrayEmpty(steps)) {
    return;
  }
  yield* Effect.forEach(
    steps,
    (step) => writer.table("editorSteps").delete(step._id).pipe(Effect.orDie),
    { discard: true }
  );
  yield* deleteSteps(documentId);
});

/**
 * Deletes one document with its snapshot and every step of its log, in the caller's
 * transaction. It is the one owner of document deletion: a school exam removes a
 * question's prompt through it. The step log of a document is kept short by the sweep
 * of `prune.ts`, and the write limit of one Convex transaction covers the rest.
 */
export const removeDocument = Effect.fn("editor.document.remove")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
) {
  const writer = yield* DatabaseWriter;
  const snapshot = yield* snapshotOf(documentId);
  yield* writer
    .table("editorSnapshots")
    .delete(snapshot._id)
    .pipe(Effect.orDie);
  yield* deleteSteps(documentId);
  yield* writer.table("editorDocuments").delete(documentId).pipe(Effect.orDie);
});
