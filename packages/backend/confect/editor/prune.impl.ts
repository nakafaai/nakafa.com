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
  PRUNE_PAGE_CLIENTS,
  PRUNE_PAGE_STEPS,
} from "@repo/backend/confect/editor/prune";
import spec from "@repo/backend/confect/editor/prune.spec";
import { snapshotVersionsOf } from "@repo/backend/confect/editor/store";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  HashMap,
  Layer,
  Option,
} from "effect";

/**
 * Deletes, in one page, the steps that a snapshot covers and that are old enough,
 * and starts the next page while the log has more. The page is read in creation
 * order. The snapshot version of each document of the page comes from its document
 * row, so the sweep never reads a snapshot row, which holds a whole document. A step
 * the snapshot does not cover yet, such as a step after the snapshot, stays in the log.
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
    const versions = yield* snapshotVersionsOf(
      Arr.dedupe(Arr.map(page.page, (step) => step.documentId))
    );
    const prunable = Arr.filter(page.page, (step) =>
      Option.exists(HashMap.get(versions, step.documentId), (snapshotVersion) =>
        isPrunable({
          at: step._creationTime,
          now,
          snapshotVersion,
          version: step.version,
        })
      )
    );
    yield* Effect.forEach(
      prunable,
      (step) => writer.table("editorSteps").delete(step._id),
      { discard: true }
    );
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.editor.prune.sweep,
        { cursor: page.continueCursor }
      );
    }
    return {
      deleted: prunable.length,
      done: page.isDone,
      scanned: page.page.length,
    };
  })
);

/**
 * Deletes, in one page, the editor-session records that a snapshot covers and that
 * were last submitted at least the keep delay ago, and starts the next page while
 * the table has more. A record whose snapshot does not cover its version stays, so
 * a session that may still hold an in-flight batch can learn whether it landed.
 */
const sweepClients = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweepClients",
  Effect.fn("editor.prune.sweepClients")(function* ({ cursor }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const now = yield* Clock.currentTimeMillis;
    const page = yield* reader
      .table("editorClients")
      .index("by_creation_time")
      .paginate({ cursor, numItems: PRUNE_PAGE_CLIENTS })
      .pipe(Effect.orDie);
    const versions = yield* snapshotVersionsOf(
      Arr.dedupe(Arr.map(page.page, (client) => client.documentId))
    );
    const prunable = Arr.filter(page.page, (client) =>
      Option.exists(
        HashMap.get(versions, client.documentId),
        (snapshotVersion) =>
          isPrunable({
            at: client.seenAt,
            now,
            snapshotVersion,
            version: client.version,
          })
      )
    );
    yield* Effect.forEach(
      prunable,
      (client) => writer.table("editorClients").delete(client._id),
      { discard: true }
    );
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.editor.prune.sweepClients,
        { cursor: page.continueCursor }
      );
    }
    return {
      deleted: prunable.length,
      done: page.isDone,
      scanned: page.page.length,
    };
  })
);

/** Implements the prune group of `prune.spec.ts`: the internal sweeps of the step log and the session records. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(sweep),
  Layer.provide(sweepClients),
  GroupImpl.finalize
);
