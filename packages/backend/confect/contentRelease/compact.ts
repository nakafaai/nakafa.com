import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { compactRows } from "@repo/backend/confect/contentRelease/compact/rows";
import {
  type CompactionCycle,
  ensureCompaction,
} from "@repo/backend/confect/contentRelease/compact/state";
import { Clock, Effect } from "effect";
export const RUN_PAGE_LIMIT = 64;
/** Returns the next durable phase after all rows in one table are exhausted. */
export function nextPhase(
  phase: CompactionCycle["phase"]
): CompactionCycle["phase"] | null {
  if (phase === "heads") {
    return "bindings";
  }
  if (phase === "bindings") {
    return "items";
  }
  if (phase === "items") {
    return "batches";
  }
  if (phase === "batches") {
    return "facts";
  }
  if (phase === "facts") {
    return "snapshots";
  }
  if (phase === "snapshots") {
    return "releases";
  }
  return null;
}

/** Persists one completed table phase or the final compacted floor. */
export const advancePhase = Effect.fn("contentRelease.advanceCompaction")(
  function* (cycle: CompactionCycle) {
    const writer = yield* DatabaseWriter;
    const phase = nextPhase(cycle.phase);
    const now = yield* Clock.currentTimeMillis;
    if (phase) {
      yield* writer.table("contentState").patch(cycle.state._id, {
        compactCursor: undefined,
        compactPhase: phase,
        updatedAt: now,
      });
      return {
        complete: false,
        phase,
      };
    }
    yield* writer.table("contentState").patch(cycle.state._id, {
      compactCursor: undefined,
      compactFloor: undefined,
      compactFrom: undefined,
      compactPhase: undefined,
      compactStartedAt: undefined,
      compactedFloor: cycle.floor,
      updatedAt: now,
    });
    return {
      complete: true,
      phase: cycle.phase,
    };
  },
  Effect.orDie
);

/** Runs one transactional, resumable history-compaction page. */
export const compactProgram = Effect.fn("contentRelease.compactPage")(
  function* () {
    const writer = yield* DatabaseWriter;
    const work = yield* ensureCompaction();
    if (work.complete) {
      const phase: CompactionCycle["phase"] = "releases";
      return {
        complete: true,
        deleted: 0,
        floor: work.floor,
        phase,
      };
    }
    const { cycle } = work;
    if (cycle.state.compactPhase === undefined) {
      return {
        complete: false,
        deleted: 0,
        floor: cycle.floor,
        phase: cycle.phase,
      };
    }
    const result = yield* compactRows(
      cycle.phase,
      cycle.from,
      cycle.floor,
      cycle.cursor,
      cycle.startedAt
    );
    if (!result.done) {
      yield* writer
        .table("contentState")
        .patch(cycle.state._id, {
          compactCursor: result.cursor ?? undefined,
          updatedAt: yield* Clock.currentTimeMillis,
        })
        .pipe(Effect.orDie);
      return {
        complete: false,
        deleted: result.deleted,
        floor: cycle.floor,
        phase: cycle.phase,
      };
    }
    const progress = yield* advancePhase(cycle);
    return {
      complete: progress.complete,
      deleted: result.deleted,
      floor: cycle.floor,
      phase: progress.phase,
    };
  }
);

/** Executes a bounded number of persisted pages for one scheduled run. */
export const runProgram = Effect.fn("contentRelease.runCompaction")(
  function* () {
    const { runMutation } = yield* MutationRunner;
    let deleted = 0;
    let latest: {
      readonly complete: boolean;
      readonly deleted: number;
      readonly floor: number;
      readonly phase: CompactionCycle["phase"];
    } = {
      complete: true,
      deleted: 0,
      floor: 0,
      phase: "releases",
    };
    for (let index = 0; index < RUN_PAGE_LIMIT; index += 1) {
      const receipt = yield* runMutation(
        refs.internal.contentRelease.compact.page,
        {}
      ).pipe(Effect.catchTag("SchemaError", Effect.die));
      deleted += receipt.deleted;
      latest = {
        ...receipt,
        deleted,
      };
      if (receipt.complete) {
        return latest;
      }
    }
    return latest;
  }
);
