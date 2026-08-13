import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { authenticateRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/authentication";
import { verifyRetainedHistoryMarkers } from "@repo/backend/convex/tryouts/history/markers";
import { verifyRetainedHistoryReadiness } from "@repo/backend/convex/tryouts/history/readiness";
import type { RetainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Proves exact source equality and completion markers before source deletion. */
export const proveFreezeHistory = Effect.fn(
  "contentRelease.cutover.proveFreezeHistory"
)(function* (ctx: ReadCtx, plan: RetainedTryoutHistoryPlan) {
  const inventory = yield* authenticateRetainedTryoutHistory(ctx, plan);
  yield* verifyRetainedHistoryReadiness(ctx, inventory, plan);
  const markers = yield* verifyRetainedHistoryMarkers(ctx, inventory, plan);
  return {
    attempts: inventory.attempts.length,
    catalogRows: plan.catalogRowCount,
    frozenPlacements: inventory.frozenPlacements.length,
    markers,
    placementRows: plan.placementRowCount,
    progressRows: inventory.progressRows.length,
    snapshotId: plan.snapshotId,
  };
});
