import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import { getScaleVersionItemsForSet } from "@repo/backend/convex/irt/scales/read";
import { getAttemptEndReasonFromStatus } from "@repo/backend/convex/lib/attempts";
import { scoreFinalizedTryoutPart } from "@repo/backend/convex/tryouts/helpers/finalize/score";
import { upsertUserTryoutLatestAttempt } from "@repo/backend/convex/tryouts/helpers/latest";
import {
  getBoundedExerciseAnswers,
  loadBoundedTryoutPartAttempts,
} from "@repo/backend/convex/tryouts/helpers/loaders";
import { computeTryoutRawScorePercentage } from "@repo/backend/convex/tryouts/helpers/metrics";
import { tryoutProductPolicies } from "@repo/backend/convex/tryouts/products";
import type { TryoutScoreStatus } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getAll } from "convex-helpers/server/relationships";

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
  const completedPartIndices = new Set(tryoutAttempt.completedPartIndices);
  const partAttempts = await loadBoundedTryoutPartAttempts(ctx.db, {
    partCount: tryout.partCount,
    tryoutAttemptId,
  });
  const finalizedPartAttempts = partAttempts.filter((partAttempt) =>
    completedPartIndices.has(partAttempt.partIndex)
  );
  const setAttempts = await getAll(
    ctx.db,
    "exerciseAttempts",
    finalizedPartAttempts.map((partAttempt) => partAttempt.setAttemptId)
  );
  const partScores = await asyncMap(
    finalizedPartAttempts,
    async (partAttempt, index) => {
      const setAttempt = setAttempts[index];

      if (!setAttempt) {
        throw new ConvexError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Tryout part is missing its exercise attempt.",
        });
      }

      const [answers, itemParamsRecords] = await Promise.all([
        getBoundedExerciseAnswers(ctx.db, {
          attemptId: partAttempt.setAttemptId,
          totalExercises: setAttempt.totalExercises,
        }),
        getScaleVersionItemsForSet(ctx.db, {
          scaleVersionId: effectiveScaleVersionId,
          setId: partAttempt.setId,
        }),
      ]);

      return scoreFinalizedTryoutPart({
        answers,
        itemParamsRecords,
        totalQuestions: setAttempt.totalExercises,
      });
    }
  );
  const allResponses = partScores.flatMap((partScore) => partScore.responses);
  const totalCorrect = partScores.reduce(
    (count, partScore) => count + partScore.rawScore,
    0
  );
  const totalQuestions = partScores.reduce(
    (count, partScore) => count + partScore.totalQuestions,
    0
  );
  const { theta, se } = estimateThetaEAP(allResponses);
  const irtScore =
    tryoutProductPolicies[tryout.product].scaleThetaToScore(theta);

  for (const [index, partAttempt] of finalizedPartAttempts.entries()) {
    const partScore = partScores[index];

    if (!partScore) {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part score is missing during aggregate sync.",
      });
    }

    await ctx.db.patch("tryoutPartAttempts", partAttempt._id, {
      theta: partScore.theta,
      thetaSE: partScore.thetaSE,
    });
  }

  await ctx.db.patch("tryoutAttempts", tryoutAttemptId, {
    completedAt: completedAtMs,
    endReason: getAttemptEndReasonFromStatus(status),
    irtScore,
    lastActivityAt: now,
    scaleVersionId: effectiveScaleVersionId,
    scoreStatus: effectiveScoreStatus,
    status,
    theta,
    thetaSE: se,
    totalCorrect,
    totalQuestions,
  });

  await upsertUserTryoutLatestAttempt(ctx, {
    attempt: {
      _id: tryoutAttempt._id,
      expiresAt: tryoutAttempt.expiresAt,
      status,
      tryoutId: tryout._id,
      userId: tryoutAttempt.userId,
    },
    tryout,
    updatedAt: now,
  });

  return {
    irtScore,
    rawScorePercentage: computeTryoutRawScorePercentage({
      totalCorrect,
      totalQuestions,
    }),
    status,
    theta,
    thetaSE: se,
  };
}
