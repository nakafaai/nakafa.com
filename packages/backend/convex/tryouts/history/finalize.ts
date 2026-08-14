import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { authenticateRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/authentication";
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

/** Checks retry identity for one already-complete attempt marker. */
function hasExactMarker(marker: HistoryMarker, values: MarkerValues) {
  return (
    marker.snapshotReleaseId === values.snapshotReleaseId &&
    marker.tryoutAttemptId === values.tryoutAttemptId &&
    marker.tryoutSnapshotId === values.tryoutSnapshotId
  );
}

/** Creates all 21 completion markers only after every readiness proof passes. */
export const finalizeRetainedTryoutHistory = Effect.fn(
  "tryouts.history.finalizeRetainedTryoutHistory"
)(function* (ctx: MutationCtx, plan: RetainedTryoutHistoryPlan) {
  const inventory = yield* authenticateRetainedTryoutHistory(ctx, plan);
  yield* verifyRetainedHistoryReadiness(ctx, inventory, plan);
  const storedMarkers = yield* historyRead(
    "Unable to read retained attempt history markers.",
    () => ctx.db.query("tryoutAttemptHistory").take(plan.attemptCount + 1)
  );
  if (storedMarkers.length > plan.attemptCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_CONFLICT",
      "Retained attempt history contains an unexpected completion marker."
    );
  }

  const markersByAttempt = new Map<string, HistoryMarker>();
  for (const marker of storedMarkers) {
    if (markersByAttempt.has(marker.tryoutAttemptId)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_CONFLICT",
        `Attempt ${marker.tryoutAttemptId} has duplicate completion markers.`
      );
    }
    markersByAttempt.set(marker.tryoutAttemptId, marker);
  }

  for (const attempt of inventory.attempts) {
    const values = yield* markerValues(attempt, plan);
    const marker = markersByAttempt.get(attempt._id);
    if (marker) {
      if (!hasExactMarker(marker, values)) {
        return yield* historyFail(
          "TRYOUT_HISTORY_CONFLICT",
          `Attempt ${attempt._id} has a different completion marker.`
        );
      }
      markersByAttempt.delete(attempt._id);
      continue;
    }
    yield* historyWrite(
      "Unable to create retained attempt history marker.",
      () => ctx.db.insert("tryoutAttemptHistory", values)
    );
  }
  if (markersByAttempt.size > 0) {
    return yield* historyFail(
      "TRYOUT_HISTORY_CONFLICT",
      "Retained attempt history contains a marker for an unknown attempt."
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
