import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/editor/deletion.spec";
import {
  PRUNE_PAGE_CLIENTS,
  PRUNE_PAGE_STEPS,
} from "@repo/backend/confect/editor/prune";
import { snapshotOf } from "@repo/backend/confect/editor/store";
import { Duration, Effect, Layer } from "effect";

/**
 * Deletes a document with the rows that belong to it. One call deletes a page of its
 * session records and a page of its steps. A call that fills a page starts the next
 * call, so no call reads or writes more than a page. The call that finds no full
 * page left deletes the snapshot and then the document row. The steps go first, so
 * a sweep that still reads one of them finds its document.
 */
const deleteDocument = FunctionImpl.make(
  databaseSchema,
  spec,
  "document",
  Effect.fn("editor.deletion.document")(function* ({ documentId }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const clients = yield* reader
      .table("editorClients")
      .index("by_documentId_and_clientId", (query) =>
        query.eq("documentId", documentId)
      )
      .take(PRUNE_PAGE_CLIENTS)
      .pipe(Effect.orDie);
    const steps = yield* reader
      .table("editorSteps")
      .index("by_documentId_and_version", (query) =>
        query.eq("documentId", documentId)
      )
      .take(PRUNE_PAGE_STEPS)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      clients,
      (client) => writer.table("editorClients").delete(client._id),
      { discard: true }
    );
    yield* Effect.forEach(
      steps,
      (step) => writer.table("editorSteps").delete(step._id),
      {
        discard: true,
      }
    );
    if (
      clients.length === PRUNE_PAGE_CLIENTS ||
      steps.length === PRUNE_PAGE_STEPS
    ) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.editor.deletion.document,
        { documentId }
      );
      return { done: false };
    }
    const snapshot = yield* snapshotOf(documentId);
    yield* writer.table("editorSnapshots").delete(snapshot._id);
    yield* writer.table("editorDocuments").delete(documentId);
    return { done: true };
  })
);

/** Implements the deletion group of `deletion.spec.ts`: the one owner of document deletion. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(deleteDocument),
  GroupImpl.finalize
);
