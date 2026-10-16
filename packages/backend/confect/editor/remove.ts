import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { PRUNE_PAGE_CLIENTS } from "@repo/backend/confect/editor/prune";
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
 * Deletes the editor-session records of one document, one page at a time, until none
 * is left. A record is a small row, so a page is bounded by its count.
 */
const deleteClients = Effect.fn("editor.document.deleteClients")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
): Effect.fn.Return<void, never, DatabaseReader | DatabaseWriter> {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const clients = yield* reader
    .table("editorClients")
    .index("by_documentId_and_clientId", (query) =>
      query.eq("documentId", documentId)
    )
    .take(PRUNE_PAGE_CLIENTS)
    .pipe(Effect.orDie);
  if (Arr.isReadonlyArrayEmpty(clients)) {
    return;
  }
  yield* Effect.forEach(
    clients,
    (client) =>
      writer.table("editorClients").delete(client._id).pipe(Effect.orDie),
    { discard: true }
  );
  yield* deleteClients(documentId);
});

/**
 * Deletes one document with its snapshot, every step of its log, and the records of its
 * editor sessions, in the caller's transaction. It is the one owner of document
 * deletion: a school exam removes a question's prompt through it. The step log of a
 * document is kept short by the sweep of `prune.ts`, and the write limit of one Convex
 * transaction covers the rest.
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
  yield* deleteClients(documentId);
  yield* writer.table("editorDocuments").delete(documentId).pipe(Effect.orDie);
});
