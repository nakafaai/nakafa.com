import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalAction,
  internalMutation as rawInternalMutation,
} from "@repo/backend/convex/_generated/server";
import { auditProgram } from "@repo/backend/convex/contentRelease/cutover/audit";
import {
  CUTOVER_ACTION_PAGE_LIMIT,
  type InventoryEntry,
  LEGACY_INVENTORY,
  type LegacyTableName,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { cutoverPhaseValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import {
  requireCutoverPhase,
  requireReaderCutoverCheckpoint,
} from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type CutoverPhase = Infer<typeof cutoverPhaseValidator>;
interface DrainPageResult {
  readonly complete: boolean;
  readonly deleted: number;
  readonly phase: CutoverPhase;
  readonly table: null | string;
}

const drainResultValidator = v.object({
  complete: v.boolean(),
  deleted: v.number(),
  phase: cutoverPhaseValidator,
  table: v.union(v.null(), v.string()),
});
const phaseReference = makeFunctionReference<
  "query",
  Record<string, never>,
  CutoverPhase | null
>("contentRelease/cutover/quiescence:phase");
const acceptAuditReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  null
>("contentRelease/cutover/quiescence:acceptAudit");
const pageReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  DrainPageResult
>("contentRelease/cutover/legacy:page");

/** Deletes one exact bounded legacy page and advances its durable checkpoint. */
export const page = rawInternalMutation({
  args: {},
  returns: drainResultValidator,
  handler: (ctx) => runConvexProgram(deleteLegacyPage(ctx)),
});

/** Runs a bounded number of crash-safe legacy deletion transactions. */
export const drainLegacy = internalAction({
  args: {},
  returns: drainResultValidator,
  handler: (ctx) => runConvexActionProgram(drainLegacyProgram(ctx)),
});

/** Quiesces writers, repeats the stable audit, then drains exact legacy rows. */
const drainLegacyProgram = Effect.fn("contentRelease.cutover.drainLegacy")(
  function* (ctx: ActionCtx) {
    let durablePhase = yield* callInternal(() =>
      ctx.runQuery(phaseReference, {})
    );
    if (durablePhase === null) {
      return yield* stateFailure(
        "The required Phase 1 quiescence checkpoint is missing."
      );
    }
    if (durablePhase === "quiescent") {
      yield* auditProgram(ctx);
      yield* callInternal(() => ctx.runMutation(acceptAuditReference, {}));
      durablePhase = "audited";
    }
    if (
      durablePhase === "legacy-drained" ||
      durablePhase === "freeze-armed" ||
      durablePhase === "frozen" ||
      durablePhase === "draining-current" ||
      durablePhase === "complete" ||
      durablePhase === "proved"
    ) {
      return {
        complete: true,
        deleted: 0,
        phase: durablePhase,
        table: null,
      };
    }
    if (durablePhase !== "audited" && durablePhase !== "draining-legacy") {
      return yield* stateFailure("Legacy drain cannot start in this phase.");
    }
    let deleted = 0;
    let latest: DrainPageResult = {
      complete: false,
      deleted: 0,
      phase: durablePhase,
      table: LEGACY_INVENTORY.at(0)?.table ?? null,
    };
    for (let index = 0; index < CUTOVER_ACTION_PAGE_LIMIT; index += 1) {
      const result = yield* callInternal(() =>
        ctx.runMutation(pageReference, {})
      );
      deleted += result.deleted;
      latest = { ...result, deleted };
      if (result.complete) {
        return latest;
      }
    }
    return latest;
  }
);

/** Deletes exactly the expected rows or fails without advancing counters. */
export const deleteLegacyPage = Effect.fn(
  "contentRelease.cutover.deleteLegacyPage"
)(function* (
  ctx: MutationCtx,
  inventory: readonly InventoryEntry<LegacyTableName>[] = LEGACY_INVENTORY
) {
  const state = yield* requireCutoverPhase(ctx, [
    "audited",
    "draining-legacy",
    "legacy-drained",
  ]);
  yield* requireReaderCutoverCheckpoint(state);
  if (state.phase === "legacy-drained") {
    return drainPageResult({
      complete: true,
      deleted: 0,
      phase: state.phase,
      table: null,
    });
  }
  const entry = inventory.at(state.legacyTableIndex);
  if (!entry) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentCutoverState", state._id, {
        phase: "legacy-drained",
        updatedAt: Date.now(),
      })
    );
    return drainPageResult({
      complete: true,
      deleted: 0,
      phase: "legacy-drained",
      table: null,
    });
  }
  const remaining = entry.expected - state.legacyTableDeleted;
  if (remaining < 0) {
    return yield* inventoryFailure(entry.table, "has invalid retry counters");
  }
  const rows =
    remaining === 0
      ? []
      : yield* Effect.promise(() =>
          ctx.db.query(entry.table).take(Math.min(entry.batchSize, remaining))
        );
  if (remaining > 0 && rows.length === 0) {
    return yield* inventoryFailure(entry.table, "has fewer rows than audited");
  }
  for (const row of rows) {
    yield* Effect.promise(() => ctx.db.delete(entry.table, row._id));
  }
  const tableDeleted = state.legacyTableDeleted + rows.length;
  const tableComplete = tableDeleted === entry.expected;
  if (tableComplete) {
    const unexpected = yield* Effect.promise(() =>
      ctx.db.query(entry.table).first()
    );
    if (unexpected) {
      return yield* inventoryFailure(entry.table, "has more rows than audited");
    }
  }
  const nextIndex = tableComplete
    ? state.legacyTableIndex + 1
    : state.legacyTableIndex;
  const complete = nextIndex === inventory.length;
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      legacyDeleted: state.legacyDeleted + rows.length,
      legacyTableDeleted: tableComplete ? 0 : tableDeleted,
      legacyTableIndex: nextIndex,
      phase: complete ? "legacy-drained" : "draining-legacy",
      updatedAt: Date.now(),
    })
  );
  return drainPageResult({
    complete,
    deleted: rows.length,
    phase: complete ? "legacy-drained" : "draining-legacy",
    table: complete ? null : (inventory.at(nextIndex)?.table ?? null),
  });
});

/** Preserves the exact phase union across Effect generator branches. */
function drainPageResult(result: DrainPageResult) {
  return result;
}

/** Creates one precise row-count deviation failure. */
function inventoryFailure(table: string, reason: string) {
  return stateFailure(`${table} ${reason}.`);
}

/** Creates one stable cutover state failure. */
function stateFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_STATE",
    `Cutover legacy drain: ${message}`
  );
}
