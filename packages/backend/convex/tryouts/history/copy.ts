import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retainHistoryRow } from "@repo/backend/convex/tryouts/history/row";
import {
  historyCopyReceiptValidator,
  historyFail,
  historyRead,
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { v } from "convex/values";
import { Effect } from "effect";

const COPY_PAGE_SIZE = 8;
type RowKind = "catalog" | "placement";

/** Returns the fixed signed index range for one history row kind. */
function historyRange(plan: RetainedTryoutHistoryPlan, rowKind: RowKind) {
  const first =
    rowKind === "catalog" ? plan.firstCatalogIndex : plan.firstPlacementIndex;
  const count =
    rowKind === "catalog" ? plan.catalogRowCount : plan.placementRowCount;
  return { first, last: first + count - 1 };
}

/** Reads one bounded source page through its immutable snapshot index. */
function loadSourcePage(
  ctx: MutationCtx,
  plan: RetainedTryoutHistoryPlan,
  rowKind: RowKind,
  afterIndex: number
) {
  if (rowKind === "catalog") {
    return historyRead("Unable to read retained try-out catalog rows.", () =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", plan.snapshotId).gt("index", afterIndex)
        )
        .take(COPY_PAGE_SIZE + 1)
    );
  }
  return historyRead("Unable to read retained try-out placement rows.", () =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", plan.snapshotId).gt("index", afterIndex)
      )
      .take(COPY_PAGE_SIZE + 1)
  );
}

/** Copies one bounded, contiguous page of authenticated Aksara 0.11 rows. */
export const copyHistoryRows = Effect.fn("tryouts.history.copyHistoryRows")(
  function* (
    ctx: MutationCtx,
    plan: RetainedTryoutHistoryPlan,
    rowKind: RowKind,
    afterIndex: number
  ) {
    const range = historyRange(plan, rowKind);
    if (
      !Number.isSafeInteger(afterIndex) ||
      afterIndex < range.first - 1 ||
      afterIndex > range.last
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `${rowKind} history cursor ${afterIndex} is outside its retained range.`
      );
    }

    const candidates = yield* loadSourcePage(ctx, plan, rowKind, afterIndex);
    const outsideRange = candidates.find(({ index }) => index > range.last);
    if (outsideRange) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `${rowKind} snapshot rows exceed the accepted retained range.`
      );
    }
    if (candidates.length === 0) {
      if (afterIndex !== range.last) {
        return yield* historyFail(
          "TRYOUT_HISTORY_NOT_READY",
          `${rowKind} snapshot history stops before index ${range.last}.`
        );
      }
      return {
        created: 0,
        done: true,
        nextIndex: afterIndex,
        processed: 0,
        unchanged: 0,
      };
    }

    const page = candidates.slice(0, COPY_PAGE_SIZE);
    for (const [offset, source] of page.entries()) {
      const expectedIndex = afterIndex + offset + 1;
      if (source.index !== expectedIndex) {
        return yield* historyFail(
          "TRYOUT_HISTORY_INTEGRITY",
          `${rowKind} snapshot history is not contiguous at index ${expectedIndex}.`
        );
      }
    }

    const results = yield* Effect.forEach(page, (source) =>
      retainHistoryRow(ctx, source, plan)
    );
    const last = page.at(-1);
    if (!last) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `${rowKind} snapshot history produced an empty retained page.`
      );
    }
    const nextIndex = last.index;
    return {
      created: results.filter((result) => result === "created").length,
      done: nextIndex === range.last && candidates.length <= COPY_PAGE_SIZE,
      nextIndex,
      processed: page.length,
      unchanged: results.filter((result) => result === "unchanged").length,
    };
  }
);

/** Internal bounded operator step for immutable retained snapshot rows. */
export const copy = internalMutation({
  args: {
    afterIndex: v.number(),
    rowKind: v.union(v.literal("catalog"), v.literal("placement")),
  },
  returns: historyCopyReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        yield* requireCutoverPhase(ctx, ["legacy-drained"]);
        return yield* copyHistoryRows(
          ctx,
          retainedTryoutHistoryPlan,
          args.rowKind,
          args.afterIndex
        );
      })
    ),
});
