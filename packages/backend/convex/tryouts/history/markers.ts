import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  historyFail,
  historyRead,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Proves the compact marker witness created by the atomic full-history gate. */
export const proveRetainedHistoryMarkers = Effect.fn(
  "tryouts.history.proveRetainedHistoryMarkers"
)(function* (ctx: ReadCtx, plan: RetainedTryoutHistoryPlan) {
  const [attempts, markers] = yield* Effect.all([
    historyRead("Unable to read retained attempts for marker proof.", () =>
      ctx.db.query("tryoutAttempts").take(plan.attemptCount + 1)
    ),
    historyRead("Unable to read retained attempt completion markers.", () =>
      ctx.db.query("tryoutAttemptHistory").take(plan.attemptCount + 1)
    ),
  ]);
  if (
    attempts.length !== plan.attemptCount ||
    markers.length !== plan.attemptCount
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${attempts.length} attempts and ${markers.length} completion markers, expected ${plan.attemptCount} each.`
    );
  }

  const attemptsById = new Map(
    attempts.map((attempt) => [attempt._id, attempt])
  );
  const releaseCounts = new Map<string, number>();
  let frozenPlacements = 0;
  for (const attempt of attempts) {
    const release = plan.releases.find(
      ({ releaseId }) => releaseId === attempt.snapshotReleaseId
    );
    if (
      !release ||
      attempt.tryoutSnapshotId !== plan.snapshotId ||
      attempt.appLocale !== attempt.locale ||
      !Number.isSafeInteger(attempt.totalQuestions) ||
      attempt.totalQuestions < 0
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained attempt ${attempt._id} does not match the marker plan.`
      );
    }
    releaseCounts.set(
      release.releaseId,
      (releaseCounts.get(release.releaseId) ?? 0) + 1
    );
    frozenPlacements += attempt.totalQuestions;
  }
  if (frozenPlacements !== plan.frozenPlacementCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      `Retained attempts declare ${frozenPlacements} placements, expected ${plan.frozenPlacementCount}.`
    );
  }
  for (const release of plan.releases) {
    if (releaseCounts.get(release.releaseId) !== release.attemptCount) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained release ${release.releaseId} does not match its accepted attempt count.`
      );
    }
  }

  const seen = new Set<string>();
  for (const marker of markers) {
    const attempt = attemptsById.get(marker.tryoutAttemptId);
    const release = plan.releases.find(
      ({ releaseId }) => releaseId === marker.snapshotReleaseId
    );
    if (
      !(attempt && release) ||
      seen.has(marker.tryoutAttemptId) ||
      marker.snapshotReleaseId !== attempt.snapshotReleaseId ||
      marker.tryoutSnapshotId !== attempt.tryoutSnapshotId ||
      marker.tryoutSnapshotId !== plan.snapshotId
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Completion marker ${marker._id} does not match retained history.`
      );
    }
    seen.add(marker.tryoutAttemptId);
  }
  if (seen.size !== attempts.length) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      "Retained attempts and completion markers are not one-to-one."
    );
  }

  return {
    attempts: attempts.length,
    catalogRows: plan.catalogRowCount,
    frozenPlacements,
    markers: markers.length,
    placementRows: plan.placementRowCount,
    progressRows: plan.progressCount,
    snapshotId: plan.snapshotId,
  };
});
