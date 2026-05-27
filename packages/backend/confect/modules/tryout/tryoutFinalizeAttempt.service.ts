import { Ref } from "@confect/core";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { syncTryoutAttemptExpiry } from "@repo/backend/confect/modules/tryout/tryoutExpiry.service";
import { syncTryoutAttemptAggregates } from "@repo/backend/confect/modules/tryout/tryoutFinalizeAggregates.service";
import { getTryoutScoreTarget } from "@repo/backend/confect/modules/tryout/tryoutIrt.service";
import {
  computeTryoutRawScorePercentage,
  isBetterLeaderboardScore,
} from "@repo/backend/confect/modules/tryout/tryoutMetrics.service";
import { getTryoutReportScore } from "@repo/backend/confect/modules/tryout/tryoutReporting.service";
import { tryoutLeaderboardWorkpool } from "@repo/backend/confect/modules/tryout/tryoutWorkpool";
import { Effect } from "effect";

/** Finalizes a whole tryout attempt once all required parts are completed. */
export const finalizeTryoutAttempt = Effect.fn(
  "tryouts.finalize.finalizeTryoutAttempt"
)(function* (args: {
  readonly completedAtMs?: number;
  readonly ctx: ConvexMutationCtx;
  readonly now: number;
  readonly tryoutAttempt: Doc<"tryoutAttempts">;
  readonly userId: Id<"users">;
}) {
  const tryout = yield* Effect.promise(() =>
    args.ctx.db.get(args.tryoutAttempt.tryoutId)
  );

  if (!tryout) {
    return yield* Effect.fail(
      new TryoutError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      })
    );
  }

  if (args.tryoutAttempt.status === "completed") {
    const rawScorePercentage = computeTryoutRawScorePercentage(
      args.tryoutAttempt
    );
    const leaderboardEntry = yield* Effect.promise(() =>
      args.ctx.db
        .query("tryoutLeaderboardEntries")
        .withIndex("by_tryoutId_and_userId", (query) =>
          query
            .eq("tryoutId", args.tryoutAttempt.tryoutId)
            .eq("userId", args.userId)
        )
        .unique()
    );

    return {
      irtScore: getTryoutReportScore(tryout.product, args.tryoutAttempt.theta),
      isOfficial:
        args.tryoutAttempt.scoreStatus === "official" &&
        (!leaderboardEntry ||
          leaderboardEntry.attemptId === args.tryoutAttempt._id),
      rawScorePercentage,
      status: "completed" as const,
      theta: args.tryoutAttempt.theta,
    };
  }

  if (args.tryoutAttempt.status === "expired") {
    return {
      irtScore: getTryoutReportScore(tryout.product, args.tryoutAttempt.theta),
      isOfficial: false,
      rawScorePercentage: computeTryoutRawScorePercentage(args.tryoutAttempt),
      status: "expired" as const,
      theta: args.tryoutAttempt.theta,
    };
  }

  if (args.tryoutAttempt.status !== "in-progress") {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Tryout attempt is not in progress.",
      })
    );
  }

  const tryoutExpiry = yield* syncTryoutAttemptExpiry(
    args.ctx,
    args.tryoutAttempt,
    args.now
  );

  if (tryoutExpiry.expired) {
    const expiredAttempt = yield* Effect.promise(() =>
      args.ctx.db.get(args.tryoutAttempt._id)
    );

    if (!expiredAttempt) {
      return yield* Effect.fail(
        new TryoutError({
          code: "ATTEMPT_NOT_FOUND",
          message: "Tryout attempt not found.",
        })
      );
    }

    return {
      irtScore: getTryoutReportScore(tryout.product, expiredAttempt.theta),
      isOfficial: false,
      rawScorePercentage: computeTryoutRawScorePercentage(expiredAttempt),
      status: "expired" as const,
      theta: expiredAttempt.theta,
    };
  }

  const scoreTarget = yield* getTryoutScoreTarget(
    args.ctx.db,
    args.tryoutAttempt
  );

  if (
    args.tryoutAttempt.completedPartIndices.length <
    args.tryoutAttempt.partSetSnapshots.length
  ) {
    return {
      irtScore: getTryoutReportScore(tryout.product, args.tryoutAttempt.theta),
      isOfficial: false,
      rawScorePercentage: computeTryoutRawScorePercentage(args.tryoutAttempt),
      status: "in-progress" as const,
      theta: args.tryoutAttempt.theta,
    };
  }

  const completedAtMs = args.completedAtMs ?? args.now;
  const completedAttempt = yield* syncTryoutAttemptAggregates(args.ctx, {
    completedAtMs,
    now: args.now,
    scaleVersionId: scoreTarget.scaleVersionId,
    scoreStatus: scoreTarget.scoreStatus,
    status: "completed",
    tryoutAttemptId: args.tryoutAttempt._id,
  });
  const leaderboardLookup =
    scoreTarget.scoreStatus === "official"
      ? Effect.promise(() =>
          args.ctx.db
            .query("tryoutLeaderboardEntries")
            .withIndex("by_tryoutId_and_userId", (query) =>
              query
                .eq("tryoutId", args.tryoutAttempt.tryoutId)
                .eq("userId", args.userId)
            )
            .unique()
        )
      : Effect.succeed(null);
  const leaderboardEntry = yield* leaderboardLookup;

  const completedAttemptForLeaderboard = {
    completedAt: completedAtMs,
    theta: completedAttempt.theta,
  };
  const isOfficial =
    scoreTarget.scoreStatus === "official" &&
    (!leaderboardEntry ||
      leaderboardEntry.attemptId === args.tryoutAttempt._id ||
      isBetterLeaderboardScore(
        completedAttemptForLeaderboard,
        leaderboardEntry
      ));

  if (isOfficial && scoreTarget.scoreStatus === "official") {
    yield* Effect.promise(() =>
      tryoutLeaderboardWorkpool.enqueueMutation(
        args.ctx,
        Ref.getFunctionReference(
          refs.internal.tryouts.mutations.internalFunctions.leaderboard
            .updateLeaderboard
        ),
        {
          tryoutAttemptId: args.tryoutAttempt._id,
        }
      )
    );
  }

  return {
    irtScore: completedAttempt.irtScore,
    isOfficial,
    rawScorePercentage: completedAttempt.rawScorePercentage,
    status: "completed" as const,
    theta: completedAttempt.theta,
  };
});
