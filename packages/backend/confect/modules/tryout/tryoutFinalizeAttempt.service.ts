import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { syncTryoutAttemptExpiry } from "@repo/backend/confect/modules/tryout/tryoutExpiry.service";
import { syncTryoutAttemptAggregates } from "@repo/backend/confect/modules/tryout/tryoutFinalizeAggregates.service";
import { getTryoutScoreTarget } from "@repo/backend/confect/modules/tryout/tryoutIrt.service";
import {
  computeTryoutRawScorePercentage,
  isBetterLeaderboardScore,
} from "@repo/backend/confect/modules/tryout/tryoutMetrics.service";
import { getTryoutReportScore } from "@repo/backend/confect/modules/tryout/tryoutReporting.service";
import type { TryoutAttempts } from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { tryoutLeaderboardWorkpool } from "@repo/backend/confect/modules/tryout/tryoutWorkpool";
import { Effect, Option } from "effect";

type TryoutAttemptDoc = typeof TryoutAttempts.Doc.Type;

/** Finalizes a whole tryout attempt once all required parts are completed. */
export const finalizeTryoutAttempt = Effect.fn(
  "tryouts.finalize.finalizeTryoutAttempt"
)(function* (args: {
  readonly completedAtMs?: number;
  readonly ctx: ConvexMutationCtx;
  readonly now: number;
  readonly tryoutAttempt: TryoutAttemptDoc;
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const tryout = yield* reader
    .table("tryouts")
    .get(args.tryoutAttempt.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
    const leaderboardEntry = yield* reader
      .table("tryoutLeaderboardEntries")
      .index("by_tryoutId_and_userId", (query) =>
        query
          .eq("tryoutId", args.tryoutAttempt.tryoutId)
          .eq("userId", args.userId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));

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
    args.tryoutAttempt,
    args.now
  );

  if (tryoutExpiry.expired) {
    const expiredAttempt = yield* reader
      .table("tryoutAttempts")
      .get(args.tryoutAttempt._id)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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

  const scoreTarget = yield* getTryoutScoreTarget(args.tryoutAttempt);

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
  const completedAttempt = yield* syncTryoutAttemptAggregates({
    completedAtMs,
    now: args.now,
    scaleVersionId: scoreTarget.scaleVersionId,
    scoreStatus: scoreTarget.scoreStatus,
    status: "completed",
    tryoutAttemptId: args.tryoutAttempt._id,
  });
  const leaderboardLookup =
    scoreTarget.scoreStatus === "official"
      ? reader
          .table("tryoutLeaderboardEntries")
          .index("by_tryoutId_and_userId", (query) =>
            query
              .eq("tryoutId", args.tryoutAttempt.tryoutId)
              .eq("userId", args.userId)
          )
          .first()
          .pipe(Effect.map(Option.getOrNull))
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
        toConvexReference(
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
