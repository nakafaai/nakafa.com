import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CURRENT_INVENTORY } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

interface CurrentTablePageResult {
  readonly complete: false;
  readonly deleted: number;
  readonly phase: "draining-current";
  readonly preserved: 0;
  readonly table: null | string;
}

/** Deletes one current table with exact pre-audit cardinality and retry state. */
export const deleteCurrentTablePage = Effect.fn(
  "contentRelease.cutover.deleteCurrentTablePage"
)(function* (
  ctx: MutationCtx,
  state: Doc<"contentCutoverState">,
  entry: (typeof CURRENT_INVENTORY)[number]
) {
  const remaining = entry.expected - state.currentTableDeleted;
  if (remaining < 0) {
    return yield* currentTableFailure(
      entry.table,
      "has invalid retry counters"
    );
  }
  const rows =
    remaining === 0
      ? []
      : yield* Effect.promise(() =>
          ctx.db.query(entry.table).take(Math.min(entry.batchSize, remaining))
        );
  if (remaining > 0 && rows.length === 0) {
    return yield* currentTableFailure(
      entry.table,
      "has fewer rows than audited"
    );
  }
  for (const row of rows) {
    yield* Effect.promise(() => ctx.db.delete(entry.table, row._id));
  }
  return yield* checkpointCurrentTable(ctx, state, entry, rows.length);
});

/** Proves exhaustion before advancing one durable current-table checkpoint. */
const checkpointCurrentTable = Effect.fn(
  "contentRelease.cutover.checkpointCurrentTable"
)(function* (
  ctx: MutationCtx,
  state: Doc<"contentCutoverState">,
  entry: (typeof CURRENT_INVENTORY)[number],
  deleted: number
) {
  const tableDeleted = state.currentTableDeleted + deleted;
  const tableComplete = tableDeleted === entry.expected;
  if (tableComplete) {
    const unexpected = yield* Effect.promise(() =>
      ctx.db.query(entry.table).first()
    );
    if (unexpected) {
      return yield* currentTableFailure(
        entry.table,
        "has more rows than audited"
      );
    }
  }
  const nextIndex = tableComplete
    ? state.currentTableIndex + 1
    : state.currentTableIndex;
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      currentDeleted: state.currentDeleted + deleted,
      currentTableDeleted: tableComplete ? 0 : tableDeleted,
      currentTableIndex: nextIndex,
      phase: "draining-current",
      updatedAt: Date.now(),
    })
  );
  return currentTablePageResult({
    complete: false,
    deleted,
    phase: "draining-current",
    preserved: 0,
    table:
      CURRENT_INVENTORY.at(nextIndex)?.table ??
      (nextIndex === CURRENT_INVENTORY.length ? "contentArtifacts" : null),
  });
});

function currentTablePageResult(result: CurrentTablePageResult) {
  return result;
}

function currentTableFailure(table: string, reason: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Cutover current drain: ${table} ${reason}.`
  );
}
