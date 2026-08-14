import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { RetainedTryoutInventory } from "@repo/backend/convex/tryouts/history/inventory";
import {
  historyFail,
  historyRead,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Proves every immutable completion marker matches its retained attempt. */
export const verifyRetainedHistoryMarkers = Effect.fn(
  "tryouts.history.verifyRetainedHistoryMarkers"
)(function* (
  ctx: ReadCtx,
  inventory: RetainedTryoutInventory,
  plan: RetainedTryoutHistoryPlan
) {
  const markers = yield* historyRead(
    "Unable to read retained attempt completion markers.",
    () => ctx.db.query("tryoutAttemptHistory").take(plan.attemptCount + 1)
  );
  if (markers.length !== plan.attemptCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${markers.length} completion markers, expected ${plan.attemptCount}.`
    );
  }

  const attempts = new Map(
    inventory.attempts.map((attempt) => [attempt._id, attempt])
  );
  const seen = new Set<string>();
  for (const marker of markers) {
    const attempt = attempts.get(marker.tryoutAttemptId);
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
  return markers.length;
});
