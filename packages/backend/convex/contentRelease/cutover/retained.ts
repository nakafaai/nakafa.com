import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutProgress = Doc<"tryoutSetProgress">;

/** Proves the exact retained inventory and every compact progress binding. */
export const verifyRetainedTryoutInventory = Effect.fn(
  "contentRelease.cutover.verifyRetainedTryoutInventory"
)(function* (
  attempts: readonly TryoutAttempt[],
  placements: readonly TryoutPlacement[],
  progress: readonly TryoutProgress[]
) {
  const plan = retainedTryoutHistoryPlan;
  if (
    attempts.length !== plan.attemptCount ||
    placements.length !== plan.frozenPlacementCount ||
    progress.length !== plan.progressCount
  ) {
    return yield* inventoryFailure(
      "Try-out retained inventory differs from the terminal proof."
    );
  }

  const attemptsById = new Map(
    attempts.map((attempt) => [attempt._id, attempt])
  );
  const latestAttemptByProgress = new Map<string, TryoutAttempt>();
  const placementCounts = new Map<TryoutAttempt["_id"], number>();
  const releaseCounts = new Map<string, number>();

  for (const attempt of attempts) {
    if (attempt.tryoutSnapshotId !== plan.snapshotId) {
      return yield* inventoryFailure(
        "A retained attempt references another try-out snapshot."
      );
    }
    const release = plan.releases.find(
      ({ releaseId }) => releaseId === attempt.snapshotReleaseId
    );
    if (!release) {
      return yield* inventoryFailure(
        "A retained attempt differs from its proved release."
      );
    }
    releaseCounts.set(
      release.releaseId,
      (releaseCounts.get(release.releaseId) ?? 0) + 1
    );

    const key = progressIdentity(attempt);
    const latest = latestAttemptByProgress.get(key);
    if (!latest || attempt.attemptNumber > latest.attemptNumber) {
      latestAttemptByProgress.set(key, attempt);
    }
  }

  for (const placement of placements) {
    if (!attemptsById.has(placement.tryoutAttemptId)) {
      return yield* inventoryFailure(
        "A retained placement references an unknown attempt."
      );
    }
    placementCounts.set(
      placement.tryoutAttemptId,
      (placementCounts.get(placement.tryoutAttemptId) ?? 0) + 1
    );
  }
  for (const attempt of attempts) {
    if (placementCounts.get(attempt._id) !== attempt.totalQuestions) {
      return yield* inventoryFailure(
        "A retained attempt differs from its proved placement count."
      );
    }
  }

  for (const release of plan.releases) {
    if (releaseCounts.get(release.releaseId) !== release.attemptCount) {
      return yield* inventoryFailure(
        `Retained release ${release.releaseId} has an unexpected attempt count.`
      );
    }
  }
  if (latestAttemptByProgress.size !== plan.progressCount) {
    return yield* inventoryFailure(
      "Retained attempts do not form the proved progress inventory."
    );
  }

  const seenProgress = new Set<string>();
  for (const row of progress) {
    const attempt = attemptsById.get(row.latestAttemptId);
    const key = progressIdentity(row);
    if (
      !attempt ||
      seenProgress.has(key) ||
      latestAttemptByProgress.get(key)?._id !== attempt._id ||
      attempt.userId !== row.userId ||
      attempt.setIdentity !== row.setIdentity ||
      attempt.countryKey !== row.countryKey ||
      attempt.examKey !== row.examKey ||
      attempt.trackKey !== row.trackKey ||
      attempt.setKey !== row.setKey ||
      attempt.appLocale !== row.appLocale ||
      attempt.attemptNumber !== row.attemptNumber ||
      attempt.status !== row.status
    ) {
      return yield* inventoryFailure(
        "Try-out progress differs from its latest retained attempt."
      );
    }
    seenProgress.add(key);
  }
  if (seenProgress.size !== latestAttemptByProgress.size) {
    return yield* inventoryFailure(
      "Try-out progress does not cover every retained identity."
    );
  }
});

function progressIdentity(
  row: Pick<TryoutAttempt | TryoutProgress, "setIdentity" | "userId">
) {
  return `${row.userId}\0${row.setIdentity}`;
}

function inventoryFailure(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
