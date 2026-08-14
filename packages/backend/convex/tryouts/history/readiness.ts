import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { RetainedTryoutInventory } from "@repo/backend/convex/tryouts/history/inventory";
import { proveRetainedHistoryMarkers } from "@repo/backend/convex/tryouts/history/markers";
import { verifyFrozenPlacement } from "@repo/backend/convex/tryouts/history/placement";
import {
  type AuthenticatedHistoryRows,
  authenticateRetainedHistoryRows,
} from "@repo/backend/convex/tryouts/history/rows";
import {
  historyFail,
  historyRead,
  historyReadinessValidator,
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Requires exact app-locale completion while legacy locale stays required. */
const verifyAppLocales = Effect.fn("tryouts.history.verifyAppLocales")(
  function* (inventory: RetainedTryoutInventory) {
    for (const attempt of inventory.attempts) {
      if (attempt.appLocale !== attempt.locale) {
        return yield* historyFail(
          "TRYOUT_HISTORY_NOT_READY",
          `Attempt ${attempt._id} is not ready for legacy locale removal.`
        );
      }
    }
    for (const progress of inventory.progressRows) {
      if (progress.appLocale !== progress.locale) {
        return yield* historyFail(
          "TRYOUT_HISTORY_NOT_READY",
          `Progress row ${progress._id} is not ready for legacy locale removal.`
        );
      }
    }
  }
);

/** Proves every frozen row is bound to its authenticated history placement. */
const verifyFrozenRows = Effect.fn("tryouts.history.verifyAllFrozenRows")(
  function* (
    inventory: RetainedTryoutInventory,
    rows: AuthenticatedHistoryRows,
    plan: RetainedTryoutHistoryPlan
  ) {
    const attempts = new Map(
      inventory.attempts.map((attempt) => [attempt._id, attempt])
    );
    for (const frozen of inventory.frozenPlacements) {
      const attempt = attempts.get(frozen.tryoutAttemptId);
      const placement = rows.placementByIdentity.get(frozen.placementIdentity);
      if (!(attempt && placement)) {
        return yield* historyFail(
          "TRYOUT_HISTORY_NOT_READY",
          `Frozen placement ${frozen._id} has no retained signed source.`
        );
      }
      yield* verifyFrozenPlacement(attempt, frozen, placement, plan);
    }
  }
);

/** Proves the mutable source rows still equal the immutable history copy. */
const verifySourceEquality = Effect.fn("tryouts.history.verifySourceEquality")(
  function* (
    ctx: ReadCtx,
    rows: AuthenticatedHistoryRows,
    plan: RetainedTryoutHistoryPlan
  ) {
    const [sourceCatalog, sourcePlacements] = yield* Effect.all([
      historyRead("Unable to read retained catalog source rows.", () =>
        ctx.db
          .query("tryoutCatalog")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", plan.snapshotId)
          )
          .take(plan.catalogRowCount + 1)
      ),
      historyRead("Unable to read retained placement source rows.", () =>
        ctx.db
          .query("tryoutPlacements")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", plan.snapshotId)
          )
          .take(plan.placementRowCount + 1)
      ),
    ]);
    if (
      sourceCatalog.length !== plan.catalogRowCount ||
      sourcePlacements.length !== plan.placementRowCount
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        "Retained mutable source inventory no longer matches the accepted plan."
      );
    }

    for (const [offset, source] of sourceCatalog.entries()) {
      const authenticated = rows.catalogRows[offset];
      const history = authenticated?.history;
      const signed = authenticated?.signed;
      if (
        !(history && signed) ||
        source.index !== history.index ||
        source.snapshotId !== history.snapshotId ||
        source.locale !== signed.record.row.locale ||
        source.identity !== tryoutCatalogIdentity(signed.record.row) ||
        source.rowHash !== history.rowHash ||
        source.rowJson !== history.rowJson
      ) {
        return yield* historyFail(
          "TRYOUT_HISTORY_INTEGRITY",
          `Catalog source row ${source.index} differs from retained history.`
        );
      }
    }
    for (const [offset, source] of sourcePlacements.entries()) {
      const authenticated = rows.placementRows[offset];
      const history = authenticated?.history;
      const signed = authenticated?.signed;
      if (
        !(history && signed) ||
        source.index !== history.index ||
        source.snapshotId !== history.snapshotId ||
        source.locale !== signed.record.row.locale ||
        source.identity !== tryoutPlacementIdentity(signed.record.row) ||
        source.rowHash !== history.rowHash ||
        source.rowJson !== history.rowJson ||
        source.answerArtifactHash !== history.answerArtifactHash ||
        source.questionArtifactHash !== history.questionArtifactHash
      ) {
        return yield* historyFail(
          "TRYOUT_HISTORY_INTEGRITY",
          `Placement source row ${source.index} differs from retained history.`
        );
      }
    }
  }
);

/** Pre-drain gate proving current source and immutable history are identical. */
export const verifyRetainedHistoryReadiness = Effect.fn(
  "tryouts.history.verifyRetainedHistoryReadiness"
)(function* (
  ctx: ReadCtx,
  inventory: RetainedTryoutInventory,
  plan: RetainedTryoutHistoryPlan
) {
  const rows = yield* authenticateRetainedHistoryRows(ctx, inventory, plan);
  yield* verifyAppLocales(inventory);
  yield* verifySourceEquality(ctx, rows, plan);
  yield* verifyFrozenRows(inventory, rows, plan);
});

/** Stable post-drain proof consumed by the deletion-complete cutover. */
export const read = internalQuery({
  args: {},
  returns: historyReadinessValidator,
  handler: (ctx) =>
    runConvexProgram(
      proveRetainedHistoryMarkers(ctx, retainedTryoutHistoryPlan)
    ),
});
