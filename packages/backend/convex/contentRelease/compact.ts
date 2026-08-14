import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalAction,
  internalMutation,
} from "@repo/backend/convex/_generated/server";
import { compactRows } from "@repo/backend/convex/contentRelease/compact/rows";
import {
  type CompactionCycle,
  ensureCompaction,
} from "@repo/backend/convex/contentRelease/compact/state";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { ensureState } from "@repo/backend/convex/contentRelease/model";
import { compactionReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

const RUN_PAGE_LIMIT = 64;
type CompactionReceipt = Infer<typeof compactionReceiptValidator>;

const compactPageReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  CompactionReceipt
>("contentRelease/compact:page");

/** Returns the next durable phase after all rows in one table are exhausted. */
function nextPhase(
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
    return "artifacts";
  }
  if (phase === "artifacts") {
    return "snapshots";
  }
  if (phase === "snapshots") {
    return "releases";
  }
  return null;
}

/** Persists one completed table phase or the final compacted floor. */
const advancePhase = Effect.fn("contentRelease.advanceCompaction")(function* (
  ctx: MutationCtx,
  cycle: CompactionCycle
) {
  const phase = nextPhase(cycle.phase);
  const now = Date.now();
  if (phase) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", cycle.state._id, {
        compactCursor: undefined,
        compactPhase: phase,
        updatedAt: now,
      })
    );
    return { complete: false, phase };
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentState", cycle.state._id, {
      compactCursor: undefined,
      compactFloor: undefined,
      compactFrom: undefined,
      compactPhase: undefined,
      compactStartedAt: undefined,
      compactedFloor: cycle.floor,
      updatedAt: now,
    })
  );
  return { complete: true, phase: cycle.phase };
});

/** Runs one transactional, resumable history-compaction page. */
export const compactProgram = Effect.fn("contentRelease.compactPage")(
  function* (ctx: MutationCtx) {
    const state = yield* ensureState(ctx);
    const cycle = yield* ensureCompaction(ctx);
    if (!cycle) {
      const phase: CompactionCycle["phase"] = "releases";
      return {
        complete: true,
        deleted: 0,
        floor: state.compactedFloor ?? 0,
        phase,
      };
    }
    if (state.compactPhase === undefined) {
      return {
        complete: false,
        deleted: 0,
        floor: cycle.floor,
        phase: cycle.phase,
      };
    }
    const result = yield* compactRows(
      ctx,
      cycle.phase,
      cycle.from,
      cycle.floor,
      cycle.cursor,
      cycle.startedAt
    );
    if (!result.done) {
      yield* Effect.promise(() =>
        ctx.db.patch("contentState", cycle.state._id, {
          compactCursor: result.cursor ?? undefined,
          updatedAt: Date.now(),
        })
      );
      return {
        complete: false,
        deleted: result.deleted,
        floor: cycle.floor,
        phase: cycle.phase,
      };
    }
    const progress = yield* advancePhase(ctx, cycle);
    return {
      complete: progress.complete,
      deleted: result.deleted,
      floor: cycle.floor,
      phase: progress.phase,
    };
  }
);

/** Executes a bounded number of persisted pages for one scheduled run. */
export const runProgram = Effect.fn("contentRelease.runCompaction")(function* (
  ctx: ActionCtx
) {
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
    const receipt = yield* callInternal(() =>
      ctx.runMutation(compactPageReference, {})
    );
    deleted += receipt.deleted;
    latest = { ...receipt, deleted };
    if (receipt.complete) {
      return latest;
    }
  }
  return latest;
});

/** Internal mutation owning one crash-safe compaction transaction. */
export const page = internalMutation({
  args: {},
  returns: compactionReceiptValidator,
  handler: (ctx) => runConvexProgram(compactProgram(ctx)),
});

/** Scheduled action draining bounded pages without one oversized mutation. */
export const run = internalAction({
  args: {},
  returns: compactionReceiptValidator,
  handler: (ctx) => runConvexProgram(runProgram(ctx)),
});
