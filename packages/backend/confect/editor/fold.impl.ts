import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureRowSize } from "@repo/backend/confect/editor/document";
import spec from "@repo/backend/confect/editor/fold.spec";
import { decodedSteps, foldedText } from "@repo/backend/confect/editor/result";
import { snapshotOf, stepsThrough } from "@repo/backend/confect/editor/store";
import { Clock, Effect, Layer, Option } from "effect";

/**
 * Folds every step that a document's snapshot lacks into the snapshot (ADR 0028). The fold
 * reads the snapshot and the steps after it, applies them in order as every editor applies
 * them, checks the result with the contract, and replaces the snapshot and its version in one
 * transaction. A submit checked this result already, so a refused fold means a stored step
 * that predates the rule, and the fold writes nothing for it. The steps are at most two reads
 * (`pendingRows`), so the fold never schedules another fold for its own backlog.
 */
const fold = FunctionImpl.make(
  databaseSchema,
  spec,
  "fold",
  Effect.fn("editor.fold.fold")(function* ({ documentId }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const document = yield* reader
      .table("editorDocuments")
      .get(documentId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.orDie
      );
    // A document deleted after the fold was scheduled has nothing to fold. A document
    // whose head is its snapshot version has no step after the snapshot, so the snapshot
    // row is read only when steps follow it.
    if (
      Option.isNone(document) ||
      document.value.head === document.value.snapshotVersion
    ) {
      return { folded: 0, skipped: 0 };
    }
    const snapshot = yield* snapshotOf(documentId);
    const rows = yield* stepsThrough(
      documentId,
      snapshot.version,
      document.value.head
    );
    const steps = yield* decodedSteps(rows);
    const folded = yield* foldedText(documentId, snapshot, steps);
    const row = {
      at: yield* Clock.currentTimeMillis,
      content: folded.content,
      documentId,
      version: document.value.head,
    };
    yield* ensureRowSize(row);
    yield* writer
      .table("editorSnapshots")
      .replace(snapshot._id, row)
      .pipe(Effect.orDie);
    yield* writer
      .table("editorDocuments")
      .patch(documentId, { snapshotVersion: document.value.head })
      .pipe(Effect.orDie);
    return { folded: rows.length, skipped: folded.skipped };
  })
);

/** Implements the fold group of `fold.spec.ts`: the one internal fold of a document's log. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(fold),
  GroupImpl.finalize
);
