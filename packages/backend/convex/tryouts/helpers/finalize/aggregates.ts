import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getAttemptEndReasonFromStatus } from "@repo/backend/convex/lib/attempts";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { computeTryoutRawScorePercentage } from "@repo/backend/convex/tryouts/helpers/metrics";
import type { TryoutScoreStatus } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";

type FinalizedTryoutStatus = Exclude<
  Doc<"tryoutAttempts">["status"],
  "in-progress"
>;

/**
 * Recompute the persisted tryout aggregate fields from finalized part attempts.
 *
 * This helper intentionally re-reads every finalized part, rebuilds the full
 * operational IRT response set, then overwrites the parent attempt's derived
 * totals and score fields in one patch. Optional `scaleVersionId` /
 * `scoreStatus` overrides are used when promoting provisional attempts to an
 * official frozen scale.
 */
export async function syncTryoutAttemptAggregates({
  completedAtMs,
  ctx,
  now,
  scaleVersionId,
  scoreStatus,
  status,
  tryoutAttemptId,
}: {
  completedAtMs: number;
  ctx: Pick<MutationCtx, "db">;
  now: number;
  scaleVersionId?: Doc<"tryoutAttempts">["scaleVersionId"];
  scoreStatus?: TryoutScoreStatus;
  status: FinalizedTryoutStatus;
  tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
}) {
  const tryoutAttempt = await ctx.db.get("tryoutAttempts", tryoutAttemptId);

  if (!tryoutAttempt) {
    throw new ConvexError({
      code: "ATTEMPT_NOT_FOUND",
      message: "Tryout attempt not found.",
    });
  }

  const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

  if (!tryout) {
    throw new ConvexError({
      code: "TRYOUT_NOT_FOUND",
      message: "Tryout not found.",
    });
  }

  const effectiveScaleVersionId =
    scaleVersionId ?? tryoutAttempt.scaleVersionId;
  const effectiveScoreStatus = scoreStatus ?? tryoutAttempt.scoreStatus;
  const {
    irtScore,
    partSnapshots,
    theta,
    thetaSE,
    totalCorrect,
    totalQuestions,
  } = await buildFinalizedTryoutSnapshot(ctx.db, {
    scaleVersionId: effectiveScaleVersionId,
    tryout,
    tryoutAttempt,
  });

  for (const partSnapshot of partSnapshots) {
    if (!partSnapshot.partAttempt) {
      continue;
    }

    await ctx.db.patch("tryoutPartAttempts", partSnapshot.partAttempt._id, {
      theta: partSnapshot.score.theta,
      thetaSE: partSnapshot.score.thetaSE,
    });
  }

  await ctx.db.patch("tryoutAttempts", tryoutAttemptId, {
    completedAt: completedAtMs,
    endReason: getAttemptEndReasonFromStatus(status),
    lastActivityAt: now,
    scaleVersionId: effectiveScaleVersionId,
    scoreStatus: effectiveScoreStatus,
    status,
    theta,
    thetaSE,
    totalCorrect,
    totalQuestions,
  });

  return {
    irtScore,
    rawScorePercentage: computeTryoutRawScorePercentage({
      totalCorrect,
      totalQuestions,
    }),
    status,
    theta,
    thetaSE,
  };
}
