import type { AuthenticatedHistoryPlacement } from "@repo/backend/convex/tryouts/history/placement";
import { verifyFrozenPlacement } from "@repo/backend/convex/tryouts/history/placement";
import {
  historyFail,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import type {
  TerminalAttempt,
  TerminalFrozenPlacement,
  TerminalProgress,
} from "@repo/backend/convex/tryouts/history/terminalState";
import { Effect } from "effect";

/** Proves every actual frozen row against one authenticated placement. */
export const verifyTerminalFrozenPlacements = Effect.fn(
  "tryouts.history.verifyTerminalFrozenPlacements"
)(function* (
  attempts: readonly TerminalAttempt[],
  frozenRows: readonly TerminalFrozenPlacement[],
  placements: ReadonlyMap<string, AuthenticatedHistoryPlacement>,
  plan: RetainedTryoutHistoryPlan
) {
  if (frozenRows.length !== plan.frozenPlacementCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${frozenRows.length} frozen placements, expected ${plan.frozenPlacementCount}.`
    );
  }
  const attemptsById = new Map(
    attempts.map((attempt) => [attempt._id, attempt])
  );
  const countsByAttempt = new Map<string, number>();
  const seenIdentities = new Set<string>();
  const seenOrders = new Set<string>();

  for (const frozen of frozenRows) {
    const attempt = attemptsById.get(frozen.tryoutAttemptId);
    const placement = placements.get(frozen.placementIdentity);
    const identityKey = `${frozen.tryoutAttemptId}\0${frozen.placementIdentity}`;
    const orderKey = `${frozen.tryoutAttemptId}\0${frozen.sectionIdentity}\0${frozen.questionOrder}`;
    if (
      !(attempt && placement) ||
      seenIdentities.has(identityKey) ||
      seenOrders.has(orderKey)
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Frozen placement ${frozen._id} is duplicate or has no authenticated owner.`
      );
    }
    seenIdentities.add(identityKey);
    seenOrders.add(orderKey);
    yield* verifyFrozenPlacement(attempt, frozen, placement, plan);
    countsByAttempt.set(
      attempt._id,
      (countsByAttempt.get(attempt._id) ?? 0) + 1
    );
  }

  for (const attempt of attempts) {
    if ((countsByAttempt.get(attempt._id) ?? 0) !== attempt.totalQuestions) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Attempt ${attempt._id} lost one or more frozen placements.`
      );
    }
  }
  return frozenRows.length;
});

/** Proves actual progress rows remain exact, localized attempt-owned state. */
export const verifyTerminalProgress = Effect.fn(
  "tryouts.history.verifyTerminalProgress"
)(function* (
  attempts: readonly TerminalAttempt[],
  progressRows: readonly TerminalProgress[],
  plan: RetainedTryoutHistoryPlan
) {
  if (progressRows.length !== plan.progressCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${progressRows.length} progress rows, expected ${plan.progressCount}.`
    );
  }
  const attemptsById = new Map(
    attempts.map((attempt) => [attempt._id, attempt])
  );
  const latestAttemptNumberByProgress = new Map<string, number>();
  const seenAttemptNumbers = new Set<string>();
  for (const attempt of attempts) {
    const progressKey = `${attempt.userId}\0${attempt.setIdentity}`;
    const attemptNumberKey = `${progressKey}\0${attempt.attemptNumber}`;
    if (seenAttemptNumbers.has(attemptNumberKey)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained attempts repeat attempt number ${attempt.attemptNumber} for one progress identity.`
      );
    }
    seenAttemptNumbers.add(attemptNumberKey);
    const latestAttemptNumber = latestAttemptNumberByProgress.get(progressKey);
    if (
      latestAttemptNumber === undefined ||
      attempt.attemptNumber > latestAttemptNumber
    ) {
      latestAttemptNumberByProgress.set(progressKey, attempt.attemptNumber);
    }
  }
  const seenAttempts = new Set<string>();
  const seenProgress = new Set<string>();
  for (const progress of progressRows) {
    const attempt = attemptsById.get(progress.latestAttemptId);
    const progressKey = `${progress.userId}\0${progress.setIdentity}`;
    if (
      !attempt ||
      seenAttempts.has(progress.latestAttemptId) ||
      seenProgress.has(progressKey) ||
      attempt.userId !== progress.userId ||
      attempt.setIdentity !== progress.setIdentity ||
      attempt.countryKey !== progress.countryKey ||
      attempt.examKey !== progress.examKey ||
      attempt.trackKey !== progress.trackKey ||
      attempt.setKey !== progress.setKey ||
      attempt.attemptNumber !== progress.attemptNumber ||
      attempt.attemptNumber !==
        latestAttemptNumberByProgress.get(progressKey) ||
      attempt.locale !== progress.locale ||
      attempt.status !== progress.status ||
      progress.appLocale !== progress.locale
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Progress row ${progress._id} no longer matches its retained attempt.`
      );
    }
    seenAttempts.add(progress.latestAttemptId);
    seenProgress.add(progressKey);
  }
  if (
    seenProgress.size !== latestAttemptNumberByProgress.size ||
    [...latestAttemptNumberByProgress.keys()].some(
      (progressKey) => !seenProgress.has(progressKey)
    )
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      "Retained attempts and progress rows do not cover the same identities."
    );
  }
  return progressRows.length;
});
