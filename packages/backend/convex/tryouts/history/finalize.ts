import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { authenticateRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/authentication";
import { proveRetainedHistoryMarkers } from "@repo/backend/convex/tryouts/history/markers";
import { verifyRetainedHistoryReadiness } from "@repo/backend/convex/tryouts/history/readiness";
import {
  historyFail,
  historyRead,
  historyReadinessValidator,
  historyStagingPhases,
  historyWrite,
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type HistoryMarker = Doc<"tryoutAttemptHistory">;
type MarkerValues = WithoutSystemFields<HistoryMarker>;

/** Builds one minimal immutable completion marker from accepted identities. */
const markerValues = Effect.fn("tryouts.history.markerValues")(function* (
  attempt: Doc<"tryoutAttempts">,
  plan: RetainedTryoutHistoryPlan
) {
  const release = plan.releases.find(
    ({ releaseId }) => releaseId === attempt.snapshotReleaseId
  );
  if (!release || attempt.appLocale === undefined) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Attempt ${attempt._id} is not ready for a history marker.`
    );
  }
  return {
    snapshotReleaseId: release.releaseId,
    tryoutAttemptId: attempt._id,
    tryoutSnapshotId: plan.snapshotId,
  } satisfies MarkerValues;
});

/** Creates all 21 completion markers only after every readiness proof passes. */
export const finalizeRetainedTryoutHistory = Effect.fn(
  "tryouts.history.finalizeRetainedTryoutHistory"
)(function* (ctx: MutationCtx, plan: RetainedTryoutHistoryPlan) {
  const storedMarkers = yield* historyRead(
    "Unable to read retained attempt history markers.",
    () => ctx.db.query("tryoutAttemptHistory").take(plan.attemptCount + 1)
  );
  if (storedMarkers.length === plan.attemptCount) {
    return yield* proveRetainedHistoryMarkers(ctx, plan);
  }
  if (storedMarkers.length > 0) {
    return yield* historyFail(
      "TRYOUT_HISTORY_CONFLICT",
      "Retained attempt history contains a partial completion marker set."
    );
  }

  const inventory = yield* authenticateRetainedTryoutHistory(ctx, plan);
  yield* verifyRetainedHistoryReadiness(ctx, inventory, plan);

  for (const attempt of inventory.attempts) {
    const values = yield* markerValues(attempt, plan);
    yield* historyWrite(
      "Unable to create retained attempt history marker.",
      () => ctx.db.insert("tryoutAttemptHistory", values)
    );
  }

  return {
    attempts: inventory.attempts.length,
    catalogRows: plan.catalogRowCount,
    frozenPlacements: inventory.frozenPlacements.length,
    markers: plan.attemptCount,
    placementRows: plan.placementRowCount,
    progressRows: inventory.progressRows.length,
    snapshotId: plan.snapshotId,
  };
});

/** Final separately invoked Phase 1a gate with atomic marker insertion. */
export const finalize = internalMutation({
  args: {},
  returns: historyReadinessValidator,
  handler: (ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        yield* requireCutoverPhase(ctx, historyStagingPhases);
        return yield* finalizeRetainedTryoutHistory(
          ctx,
          retainedTryoutHistoryPlan
        );
      }).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
