import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  isPrunable,
  PRUNE_PAGE_STEPS,
} from "@repo/backend/confect/editor/prune";
import spec from "@repo/backend/confect/editor/prune.spec";
import { snapshotOf } from "@repo/backend/confect/editor/store";
import { Array as Arr, Clock, Duration, Effect, Layer } from "effect";

/**
 * Deletes, in one page, the steps that a snapshot covers and that are old enough,
 * and starts the next page while the log has more. The page is read in creation
 * order. Each document of the page is read once for its snapshot, and its steps of
 * the page are then decided against that version. A step the snapshot does not
 * cover yet, such as a step after the snapshot, stays in the log.
 */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("editor.prune.sweep")(function* ({ cursor }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const now = yield* Clock.currentTimeMillis;
    const page = yield* reader
      .table("editorSteps")
      .index("by_creation_time")
      .paginate({ cursor, numItems: PRUNE_PAGE_STEPS })
      .pipe(Effect.orDie);
    const documentIds = Arr.dedupe(
      Arr.map(page.page, (step) => step.documentId)
    );
    const deleted = yield* Effect.forEach(documentIds, (documentId) =>
      Effect.gen(function* () {
        const snapshot = yield* snapshotOf(documentId);
        const prunable = Arr.filter(
          page.page,
          (step) =>
            step.documentId === documentId &&
            isPrunable({
              createdAt: step._creationTime,
              now,
              snapshotVersion: snapshot.version,
              version: step.version,
            })
        );
        yield* Effect.forEach(
          prunable,
          (step) => writer.table("editorSteps").delete(step._id),
          { discard: true }
        );
        return prunable.length;
      })
    );
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.editor.prune.sweep,
        { cursor: page.continueCursor }
      );
    }
    return {
      deleted: Arr.reduce(deleted, 0, (total, count) => total + count),
      done: page.isDone,
      scanned: page.page.length,
    };
  })
);

/** Implements the prune group of `prune.spec.ts`: the internal sweep of the step log. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(sweep),
  GroupImpl.finalize
);
