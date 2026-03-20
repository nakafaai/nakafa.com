import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  computeTryoutRawScorePercentage,
  getBestOfficialCompletedTryoutAttempt,
  getTryoutAttemptScoreStatus,
  getTryoutScoreTarget,
  syncTryoutAttemptAggregates,
  syncTryoutAttemptExpiry,
} from "@repo/backend/convex/tryouts/helpers";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, type Infer, v } from "convex/values";

export const completeTryoutResultValidator = v.object({
  status: tryoutStatusValidator,
  isOfficial: v.boolean(),
  theta: v.number(),
  irtScore: v.number(),
  rawScorePercentage: v.number(),
});

type CompleteTryoutResult = Infer<typeof completeTryoutResultValidator>;

/** Finalizes one tryout attempt into its current result state. */
export async function finalizeTryoutAttempt({
  completedAtMs,
  ctx,
  now,
  tryoutAttempt,
  userId,
}: {
  completedAtMs?: number;
  ctx: Pick<MutationCtx, "db" | "scheduler">;
  now: number;
  tryoutAttempt: Doc<"tryoutAttempts">;
  userId: Id<"users">;
}) {
  if (tryoutAttempt.status === "completed") {
    const rawScorePercentage = computeTryoutRawScorePercentage(tryoutAttempt);
    const bestOfficialAttempt = await getBestOfficialCompletedTryoutAttempt(
      ctx.db,
      {
        userId,
        tryoutId: tryoutAttempt.tryoutId,
      }
    );

    return {
      status: "completed",
      isOfficial:
        bestOfficialAttempt?._id === tryoutAttempt._id &&
        getTryoutAttemptScoreStatus(tryoutAttempt) === "official",
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage,
    } satisfies CompleteTryoutResult;
  }

  if (tryoutAttempt.status === "expired") {
    return {
      status: "expired",
      isOfficial: false,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScorePercentage: computeTryoutRawScorePercentage(tryoutAttempt),
    } satisfies CompleteTryoutResult;
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
    } satisfies CompleteTryoutResult;
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
    } satisfies CompleteTryoutResult;
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

  const bestOfficialAttempt =
    scoreTarget.scoreStatus === "official"
      ? await getBestOfficialCompletedTryoutAttempt(ctx.db, {
          userId,
          tryoutId: tryoutAttempt.tryoutId,
        })
      : null;
  const isOfficial = bestOfficialAttempt?._id === tryoutAttempt._id;

  if (isOfficial && scoreTarget.scoreStatus === "official") {
    await ctx.scheduler.runAfter(
      0,
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
  } satisfies CompleteTryoutResult;
}
