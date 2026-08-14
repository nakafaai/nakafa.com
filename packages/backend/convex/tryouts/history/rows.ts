import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { decodeHistoryRowJson } from "@repo/backend/convex/tryouts/history/decode";
import {
  historyFail,
  historyRead,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type HistoryRowKind = Doc<"tryoutHistoryRows">["rowKind"];

/** Loads and authenticates one complete retained row family for reader use. */
export const loadStoredTryoutRows = Effect.fn("tryouts.history.loadStoredRows")(
  function* (ctx: QueryCtx, snapshotId: string, rowKind: HistoryRowKind) {
    if (snapshotId !== retainedTryoutHistoryPlan.snapshotId) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        "Retained reader selected an unexpected try-out snapshot."
      );
    }
    const expectedCount =
      rowKind === "catalog"
        ? retainedTryoutHistoryPlan.catalogRowCount
        : retainedTryoutHistoryPlan.placementRowCount;
    const firstIndex =
      rowKind === "catalog"
        ? retainedTryoutHistoryPlan.firstCatalogIndex
        : retainedTryoutHistoryPlan.firstPlacementIndex;
    const stored = yield* historyRead(
      `Unable to read retained try-out ${rowKind} rows.`,
      () =>
        ctx.db
          .query("tryoutHistoryRows")
          .withIndex("by_snapshotId_and_rowKind_and_index", (index) =>
            index.eq("snapshotId", snapshotId).eq("rowKind", rowKind)
          )
          .take(expectedCount + 1)
    );
    if (stored.length !== expectedCount) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained try-out ${rowKind} inventory does not match its audited count.`
      );
    }
    for (const [offset, row] of stored.entries()) {
      if (row.index !== firstIndex + offset) {
        return yield* historyFail(
          "TRYOUT_HISTORY_INTEGRITY",
          `Retained try-out ${rowKind} inventory is not in canonical index order.`
        );
      }
    }
    return yield* Effect.forEach(stored, decodeStoredHistoryRow);
  }
);

/** Loads one authenticated retained placement by its frozen row hash. */
export const loadStoredTryoutPlacement = Effect.fn(
  "tryouts.history.loadStoredPlacement"
)(function* (ctx: QueryCtx, snapshotId: string, rowHash: string) {
  if (snapshotId !== retainedTryoutHistoryPlan.snapshotId) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      "Retained reader selected an unexpected try-out snapshot."
    );
  }
  const stored = yield* historyRead(
    "Unable to read one retained try-out placement.",
    () =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_snapshotId_and_rowKind_and_rowHash", (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("rowKind", "placement")
            .eq("rowHash", rowHash)
        )
        .unique()
  );
  if (!stored) {
    return null;
  }
  const decoded = yield* decodeStoredHistoryRow(stored);
  if (decoded.rowKind !== "placement") {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      "Retained try-out placement changed its row kind."
    );
  }
  return decoded.record.row;
});

/** Decodes one exact old envelope and checks its indexed storage facts. */
const decodeStoredHistoryRow = Effect.fn(
  "tryouts.history.decodeStoredReaderRow"
)(function* (stored: Doc<"tryoutHistoryRows">) {
  const decoded = yield* decodeHistoryRowJson(stored.rowJson, stored.rowHash);
  if (
    decoded.rowKind !== stored.rowKind ||
    decoded.record.rowHash !== stored.rowHash
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      `Retained try-out ${stored.rowKind} row changed its storage identity.`
    );
  }
  if (
    stored.rowKind === "placement" &&
    decoded.rowKind === "placement" &&
    (stored.answerArtifactHash !== decoded.record.row.answerArtifactHash ||
      stored.questionArtifactHash !== decoded.record.row.questionArtifactHash)
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      "Retained try-out placement changed its artifact identity."
    );
  }
  return decoded;
});
