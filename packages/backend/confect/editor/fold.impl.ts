import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  ensureRowSize,
  storedDocument,
} from "@repo/backend/confect/editor/document";
import { foldSteps, snapshotNode } from "@repo/backend/confect/editor/fold";
import spec from "@repo/backend/confect/editor/fold.spec";
import { assessmentModel } from "@repo/backend/confect/editor/model";
import { decodeStep } from "@repo/backend/confect/editor/step";
import { snapshotOf, stepsAfter } from "@repo/backend/confect/editor/store";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Clock, Duration, Effect, Layer, Option } from "effect";

/**
 * Folds one page of a document's log into its snapshot (ADR 0028). The fold reads the
 * snapshot and the page of steps after it, applies the steps in order as every editor
 * applies them, checks the result with the contract, and replaces the snapshot and its
 * version in one transaction. The page is one read of the log, so the fold reads no more
 * than that. A log that still holds steps after the page starts the next fold, so a
 * backlog is folded one page at a time.
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
      return { done: true, folded: 0, skipped: 0 };
    }
    const snapshot = yield* snapshotOf(documentId);
    const rows = yield* stepsAfter(documentId, snapshot.version);
    const last = yield* Effect.fromOption(Arr.last(rows)).pipe(Effect.orDie);
    const start = yield* snapshotNode(assessmentModel, snapshot.content);
    const steps = yield* Effect.forEach(rows, (row) =>
      decodeStep(row.step).pipe(Effect.orDie)
    );
    const folded = yield* foldSteps(
      assessmentModel,
      start,
      snapshot.version,
      steps
    );
    const content = yield* storedDocument(encodeJsonText(folded.doc.toJSON()));
    const row = {
      at: yield* Clock.currentTimeMillis,
      content,
      documentId,
      version: last.version,
    };
    yield* ensureRowSize(row);
    yield* writer
      .table("editorSnapshots")
      .replace(snapshot._id, row)
      .pipe(Effect.orDie);
    yield* writer
      .table("editorDocuments")
      .patch(documentId, { snapshotVersion: last.version })
      .pipe(Effect.orDie);
    const done = last.version >= document.value.head;
    if (!done) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.editor.fold.fold,
        { documentId }
      );
    }
    return { done, folded: rows.length, skipped: folded.skipped.length };
  })
);

/** Implements the fold group of `fold.spec.ts`: the one internal fold of a document's log. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(fold),
  GroupImpl.finalize
);
