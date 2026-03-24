import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncTryoutAttemptExpiry } from "@repo/backend/convex/tryouts/helpers/expiry";
import {
  computeTryoutRawScorePercentage,
  getTryoutScoreTarget,
  isBetterLeaderboardScore,
  syncTryoutAttemptAggregates,
} from "@repo/backend/convex/tryouts/helpers/scoring";
import { tryoutLeaderboardWorkpool } from "@repo/backend/convex/tryouts/workpool";
import { ConvexError } from "convex/values";

type CompleteTryoutResult = Pick<
  Doc<"tryoutAttempts">,
  "irtScore" | "status" | "theta"
> & {
  isOfficial: boolean;
  rawScorePercentage: number;
};

/** Finalizes one tryout attempt into its current result state. */
export async function finalizeTryoutAttempt({
  completedAtMs,
  ctx,
  now,
  tryoutAttempt,
  userId,
}: {
  completedAtMs?: number;
  ctx: MutationCtx;
  now: number;
  tryoutAttempt: Doc<"tryoutAttempts">;
  userId: Id<"users">;
}): Promise<CompleteTryoutResult> {
  if (tryoutAttempt.status === "completed") {
    const rawScorePercentage = computeTryoutRawScorePercentage(tryoutAttempt);
    const leaderboardEntry = await ctx.db
      .query("tryoutLeaderboardEntries")
      .withIndex("by_tryoutId_and_userId", (q) =>
        q.eq("tryoutId", tryoutAttempt.tryoutId).eq("userId", userId)
      )
      .unique();

    return {
      status: "completed",
      isOfficial:
        tryoutAttempt.scoreStatus === "official" &&
        (!leaderboardEntry || leaderboardEntry.attemptId === tryoutAttempt._id),
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage,
    };
  }

  if (tryoutAttempt.status === "expired") {
    return {
      status: "expired",
      isOfficial: false,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage: computeTryoutRawScorePercentage(tryoutAttempt),
    };
  }

  if (tryoutAttempt.status !== "in-progress") {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATUS",
      message: "Tryout attempt is not in progress.",
    });
  }

  const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

  if (tryoutExpiry.expired) {
    const expiredAttempt = await ctx.db.get(
      "tryoutAttempts",
      tryoutAttempt._id
    );

    if (!expiredAttempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      });
    }

    return {
      status: "expired",
      isOfficial: false,
      theta: expiredAttempt.theta,
      irtScore: expiredAttempt.irtScore,
      rawScorePercentage: computeTryoutRawScorePercentage(expiredAttempt),
    };
  }

  const [tryout, scoreTarget] = await Promise.all([
    ctx.db.get("tryouts", tryoutAttempt.tryoutId),
    getTryoutScoreTarget(ctx.db, tryoutAttempt),
  ]);

  if (!tryout) {
    throw new ConvexError({
      code: "TRYOUT_NOT_FOUND",
      message: "Tryout not found.",
    });
  }

  if (tryoutAttempt.completedPartIndices.length < tryout.partCount) {
    return {
      status: "in-progress",
      isOfficial: false,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage: computeTryoutRawScorePercentage(tryoutAttempt),
    };
  }

  const completedAttempt = await syncTryoutAttemptAggregates({
    completedAtMs: completedAtMs ?? now,
    ctx,
    now,
    scaleVersionId: scoreTarget.scaleVersionId,
    scoreStatus: scoreTarget.scoreStatus,
    status: "completed",
    tryoutAttemptId: tryoutAttempt._id,
  });

  const leaderboardEntry =
    scoreTarget.scoreStatus === "official"
      ? await ctx.db
          .query("tryoutLeaderboardEntries")
          .withIndex("by_tryoutId_and_userId", (q) =>
            q.eq("tryoutId", tryoutAttempt.tryoutId).eq("userId", userId)
          )
          .unique()
      : null;
  const completedAttemptForLeaderboard = {
    completedAt: completedAtMs ?? now,
    theta: completedAttempt.theta,
  };
  const isOfficial =
    scoreTarget.scoreStatus === "official" &&
    (!leaderboardEntry ||
      leaderboardEntry.attemptId === tryoutAttempt._id ||
      isBetterLeaderboardScore(
        completedAttemptForLeaderboard,
        leaderboardEntry
      ));

  if (isOfficial && scoreTarget.scoreStatus === "official") {
    await tryoutLeaderboardWorkpool.enqueueMutation(
      ctx,
      internal.tryouts.internalMutations.updateLeaderboard,
      {
        tryoutAttemptId: tryoutAttempt._id,
      }
    );
  }

  return {
    status: "completed",
    isOfficial,
    theta: completedAttempt.theta,
    irtScore: completedAttempt.irtScore,
    rawScorePercentage: completedAttempt.rawScorePercentage,
  };
}
