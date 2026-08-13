import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteCurrentTablePage } from "@repo/backend/convex/contentRelease/cutover/currentTable";
import {
  CURRENT_INVENTORY,
  RETAINED_ARTIFACT_COUNT,
  RETAINED_TRYOUT_SNAPSHOT_ID,
  RETENTION_INVENTORY,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { cutoverPhaseValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import {
  requireCutoverPhase,
  requireReaderCutoverCheckpoint,
} from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { hasRetainedHistoryArtifactReference } from "@repo/backend/convex/tryouts/history/row";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type CutoverPhase = Infer<typeof cutoverPhaseValidator>;
interface CurrentPageResult {
  readonly complete: boolean;
  readonly deleted: number;
  readonly phase: CutoverPhase;
  readonly preserved: number;
  readonly table: null | string;
}

const currentDrainResultValidator = v.object({
  complete: v.boolean(),
  deleted: v.number(),
  phase: cutoverPhaseValidator,
  preserved: v.number(),
  table: v.union(v.null(), v.string()),
});

/** Deletes one bounded current-store page and checkpoints exact retry state. */
export const page = internalMutation({
  args: {},
  returns: currentDrainResultValidator,
  handler: (ctx) => runConvexProgram(deleteCurrentPage(ctx)),
});

export const deleteCurrentPage = Effect.fn(
  "contentRelease.cutover.deleteCurrentPage"
)(function* (
  ctx: MutationCtx,
  retainedArtifactCount = RETAINED_ARTIFACT_COUNT,
  artifactCount = RETENTION_INVENTORY[0].expected
) {
  const state = yield* requireCutoverPhase(ctx, [
    "frozen",
    "draining-current",
    "complete",
    "proved",
  ]);
  yield* requireReaderCutoverCheckpoint(state);
  if (state.phase === "complete" || state.phase === "proved") {
    return completedResult();
  }
  const entry = CURRENT_INVENTORY.at(state.currentTableIndex);
  if (entry) {
    return yield* deleteCurrentTablePage(ctx, state, entry);
  }
  if (state.currentTableIndex === CURRENT_INVENTORY.length) {
    return yield* deleteArtifactPage(
      ctx,
      state,
      retainedArtifactCount,
      artifactCount
    );
  }
  if (state.currentTableIndex === CURRENT_INVENTORY.length + 1) {
    return yield* deleteSnapshotPage(ctx, state);
  }
  return yield* completeDrain(ctx, state);
});

/** Deletes only artifacts with zero immutable retained-history references. */
const deleteArtifactPage = Effect.fn(
  "contentRelease.cutover.deleteArtifactPage"
)(function* (
  ctx: MutationCtx,
  state: Doc<"contentCutoverState">,
  retainedArtifactCount: number,
  artifactCount: number
) {
  const rows = yield* Effect.promise(() => {
    const query = ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (index) => {
        const cursor = state.currentCursor;
        return cursor ? index.gt("artifactHash", cursor) : index;
      });
    return query.take(4);
  });
  let deleted = 0;
  let preserved = 0;
  for (const artifact of rows) {
    if (
      yield* hasRetainedHistoryArtifactReference(ctx, artifact.artifactHash)
    ) {
      preserved += 1;
      continue;
    }
    yield* Effect.promise(() =>
      ctx.db.delete("contentArtifacts", artifact._id)
    );
    deleted += 1;
  }
  const tableDeleted = state.currentTableDeleted + deleted;
  const tablePreserved = state.currentTablePreserved + preserved;
  const tableComplete = rows.length < 4;
  if (
    tableComplete &&
    (tablePreserved !== retainedArtifactCount ||
      tableDeleted + tablePreserved !== artifactCount)
  ) {
    return yield* currentFailure(
      "contentArtifacts",
      `processed ${tableDeleted + tablePreserved} with ${tablePreserved} retained, expected ${artifactCount} with ${retainedArtifactCount} retained`
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      currentCursor: tableComplete ? undefined : rows.at(-1)?.artifactHash,
      currentDeleted: state.currentDeleted + deleted,
      currentTableDeleted: tableComplete ? 0 : tableDeleted,
      currentTableIndex: tableComplete
        ? state.currentTableIndex + 1
        : state.currentTableIndex,
      currentTablePreserved: tableComplete ? 0 : tablePreserved,
      phase: "draining-current",
      updatedAt: Date.now(),
    })
  );
  return currentPageResult({
    complete: false,
    deleted,
    phase: "draining-current",
    preserved,
    table: tableComplete ? "contentSnapshots" : "contentArtifacts",
  });
});

/** Removes every snapshot except the one immutable history identity. */
const deleteSnapshotPage = Effect.fn(
  "contentRelease.cutover.deleteSnapshotPage"
)(function* (ctx: MutationCtx, state: Doc<"contentCutoverState">) {
  const rows = yield* Effect.promise(() =>
    ctx.db.query("contentSnapshots").take(4)
  );
  let retained = 0;
  let deleted = 0;
  for (const snapshot of rows) {
    if (
      snapshot.family === "tryout" &&
      snapshot.snapshotId === RETAINED_TRYOUT_SNAPSHOT_ID
    ) {
      retained += 1;
      continue;
    }
    yield* Effect.promise(() =>
      ctx.db.delete("contentSnapshots", snapshot._id)
    );
    deleted += 1;
  }
  const remaining = yield* Effect.promise(() =>
    ctx.db.query("contentSnapshots").take(2)
  );
  if (
    remaining.length !== 1 ||
    remaining[0]?.family !== "tryout" ||
    remaining[0].snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID ||
    retained !== 1
  ) {
    return yield* currentFailure(
      "contentSnapshots",
      "does not contain the exact retained singleton"
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      currentDeleted: state.currentDeleted + deleted,
      currentTableDeleted: 0,
      currentTableIndex: state.currentTableIndex + 1,
      currentTablePreserved: 0,
      phase: "draining-current",
      updatedAt: Date.now(),
    })
  );
  return currentPageResult({
    complete: false,
    deleted,
    phase: "draining-current",
    preserved: retained,
    table: "proof",
  });
});

/** Marks the old mutable store drained only after final proof runs next. */
const completeDrain = Effect.fn("contentRelease.cutover.completeDrain")(
  function* (ctx: MutationCtx, state: Doc<"contentCutoverState">) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentCutoverState", state._id, {
        phase: "complete",
        updatedAt: Date.now(),
      })
    );
    return completedResult();
  }
);

function completedResult() {
  return currentPageResult({
    complete: true,
    deleted: 0,
    phase: "complete",
    preserved: 0,
    table: null,
  });
}

/** Preserves the exact public result union across Effect generator branches. */
function currentPageResult(result: CurrentPageResult) {
  return result;
}

function currentFailure(table: string, reason: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Cutover current drain: ${table} ${reason}.`
  );
}
