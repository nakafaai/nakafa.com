import type { Doc } from "@repo/backend/convex/_generated/dataModel";
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

/** Exact database inventory that must remain stable throughout Phase 1a. */
export interface RetainedTryoutInventory {
  readonly attempts: readonly Doc<"tryoutAttempts">[];
  readonly bundles: readonly Doc<"tryoutBundles">[];
  readonly frozenPlacements: readonly Doc<"tryoutAttemptPlacements">[];
  readonly progressRows: readonly Doc<"tryoutSetProgress">[];
  readonly snapshot: Doc<"contentSnapshots">;
}

/** Reads one globally bounded table and rejects any row beyond the plan. */
function readBoundedTable<
  TableName extends
    keyof import("@repo/backend/convex/_generated/dataModel").DataModel,
>(ctx: ReadCtx, tableName: TableName, expected: number) {
  return historyRead(`Unable to read retained ${tableName}.`, () =>
    ctx.db.query(tableName).take(expected + 1)
  );
}

/** Requires the exact retained release split proven in production. */
const verifyReleaseSplit = Effect.fn("tryouts.history.verifyReleaseSplit")(
  function* (
    attempts: readonly Doc<"tryoutAttempts">[],
    plan: RetainedTryoutHistoryPlan
  ) {
    for (const release of plan.releases) {
      const count = attempts.filter(
        ({ snapshotReleaseId }) => snapshotReleaseId === release.releaseId
      ).length;
      if (count !== release.attemptCount) {
        return yield* historyFail(
          "TRYOUT_HISTORY_NOT_READY",
          `Release ${release.releaseId} has ${count} retained attempts, expected ${release.attemptCount}.`
        );
      }
    }

    const knownReleaseIds = new Set(
      plan.releases.map(({ releaseId }) => releaseId)
    );
    const unknown = attempts.find(
      ({ snapshotReleaseId }) => !knownReleaseIds.has(snapshotReleaseId)
    );
    if (unknown) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `Attempt ${unknown._id} references unexpected release ${unknown.snapshotReleaseId}.`
      );
    }
  }
);

/** Proves every frozen placement belongs to one complete retained attempt. */
const verifyFrozenPlacements = Effect.fn(
  "tryouts.history.verifyFrozenPlacementInventory"
)(function* (
  attempts: readonly Doc<"tryoutAttempts">[],
  placements: readonly Doc<"tryoutAttemptPlacements">[],
  plan: RetainedTryoutHistoryPlan
) {
  if (placements.length !== plan.frozenPlacementCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${placements.length} frozen placements, expected ${plan.frozenPlacementCount}.`
    );
  }

  const attemptCounts = new Map<string, number>();
  const seenIdentities = new Set<string>();
  const seenOrders = new Set<string>();
  for (const placement of placements) {
    const identity = `${placement.tryoutAttemptId}\0${placement.placementIdentity}`;
    const order = `${placement.tryoutAttemptId}\0${placement.sectionIdentity}\0${placement.questionOrder}`;
    if (seenIdentities.has(identity) || seenOrders.has(order)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `Frozen placement ${placement._id} duplicates retained attempt history.`
      );
    }
    seenIdentities.add(identity);
    seenOrders.add(order);
    attemptCounts.set(
      placement.tryoutAttemptId,
      (attemptCounts.get(placement.tryoutAttemptId) ?? 0) + 1
    );
  }

  for (const attempt of attempts) {
    const count = attemptCounts.get(attempt._id) ?? 0;
    if (count !== attempt.totalQuestions) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `Attempt ${attempt._id} has ${count} frozen placements, expected ${attempt.totalQuestions}.`
      );
    }
    attemptCounts.delete(attempt._id);
  }

  const unknownAttemptId = attemptCounts.keys().next().value;
  if (unknownAttemptId !== undefined) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Frozen placements reference unknown attempt ${unknownAttemptId}.`
    );
  }
});

/** Proves progress rows point only at retained attempts with one locale. */
const verifyProgress = Effect.fn("tryouts.history.verifyProgressInventory")(
  function* (
    attempts: readonly Doc<"tryoutAttempts">[],
    progressRows: readonly Doc<"tryoutSetProgress">[],
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
    for (const progress of progressRows) {
      const attempt = attemptsById.get(progress.latestAttemptId);
      if (
        !attempt ||
        attempt.userId !== progress.userId ||
        attempt.setIdentity !== progress.setIdentity ||
        attempt.countryKey !== progress.countryKey ||
        attempt.examKey !== progress.examKey ||
        attempt.trackKey !== progress.trackKey ||
        attempt.setKey !== progress.setKey ||
        attempt.attemptNumber !== progress.attemptNumber ||
        attempt.locale !== progress.locale ||
        (progress.appLocale !== undefined &&
          progress.appLocale !== progress.locale)
      ) {
        return yield* historyFail(
          "TRYOUT_HISTORY_NOT_READY",
          `Progress row ${progress._id} lost its retained attempt locale.`
        );
      }
    }
  }
);

/** Audits the exact retained production inventory without mutating it. */
export const loadRetainedTryoutInventory = Effect.fn(
  "tryouts.history.loadRetainedTryoutInventory"
)(function* (ctx: ReadCtx, plan: RetainedTryoutHistoryPlan) {
  const [attempts, bundles, frozenPlacements, progressRows, snapshot] =
    yield* Effect.all([
      readBoundedTable(ctx, "tryoutAttempts", plan.attemptCount),
      readBoundedTable(ctx, "tryoutBundles", plan.releases.length),
      readBoundedTable(
        ctx,
        "tryoutAttemptPlacements",
        plan.frozenPlacementCount
      ),
      readBoundedTable(ctx, "tryoutSetProgress", plan.progressCount),
      historyRead("Unable to read the retained try-out snapshot.", () =>
        ctx.db
          .query("contentSnapshots")
          .withIndex("by_family_and_snapshotId", (query) =>
            query.eq("family", "tryout").eq("snapshotId", plan.snapshotId)
          )
          .unique()
      ),
    ]);

  if (attempts.length !== plan.attemptCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${attempts.length} retained attempts, expected ${plan.attemptCount}.`
    );
  }
  if (bundles.length !== plan.releases.length) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${bundles.length} retained bundles, expected ${plan.releases.length}.`
    );
  }
  if (!snapshot || snapshot.verifiedAt === undefined) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Retained snapshot ${plan.snapshotId} is missing or unverified.`
    );
  }

  for (const attempt of attempts) {
    if (
      attempt.tryoutSnapshotId !== plan.snapshotId ||
      (attempt.appLocale !== undefined && attempt.appLocale !== attempt.locale)
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `Attempt ${attempt._id} lost its retained snapshot or locale.`
      );
    }
  }

  const totalQuestions = attempts.reduce(
    (total, attempt) => total + attempt.totalQuestions,
    0
  );
  if (totalQuestions !== plan.frozenPlacementCount) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Retained attempts declare ${totalQuestions} questions, expected ${plan.frozenPlacementCount}.`
    );
  }

  yield* verifyReleaseSplit(attempts, plan);
  yield* verifyProgress(attempts, progressRows, plan);
  yield* verifyFrozenPlacements(attempts, frozenPlacements, plan);

  return {
    attempts,
    bundles,
    frozenPlacements,
    progressRows,
    snapshot,
  } satisfies RetainedTryoutInventory;
});
