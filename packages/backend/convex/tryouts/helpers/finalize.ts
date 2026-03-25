import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  buildFinalizedExerciseAttemptPatch,
  computeAttemptDurationSeconds,
} from "@repo/backend/convex/exercises/utils";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import { getScaleVersionItemsForSet } from "@repo/backend/convex/irt/scales/read";
import { getAttemptEndReasonFromStatus } from "@repo/backend/convex/lib/attempts";
import { buildOperationalIrtResponses } from "@repo/backend/convex/tryouts/helpers/irt";
import { upsertUserTryoutLatestAttempt } from "@repo/backend/convex/tryouts/helpers/latest";
import {
  getBoundedExerciseAnswers,
  loadBoundedTryoutPartAttempts,
} from "@repo/backend/convex/tryouts/helpers/loaders";
import {
  computeTryoutRawScorePercentage,
  countCorrectAnswers,
} from "@repo/backend/convex/tryouts/helpers/metrics";
import { tryoutProductPolicies } from "@repo/backend/convex/tryouts/products";
import type { TryoutScoreStatus } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getAll } from "convex-helpers/server/relationships";

type FinalizedExerciseAttemptStatus = Exclude<
  Doc<"exerciseAttempts">["status"],
  "in-progress"
>;
type FinalizedTryoutStatus = Exclude<
  Doc<"tryoutAttempts">["status"],
  "in-progress"
>;

/** Finalize one started tryout part from its persisted exercise answers. */
export async function finalizeTryoutPartAttempt({
  ctx,
  finishedAtMs,
  now,
  partAttempt,
  status,
  tryoutAttemptId,
}: {
  ctx: Pick<MutationCtx, "db" | "scheduler">;
  finishedAtMs: number;
  now: number;
  partAttempt: Doc<"tryoutPartAttempts">;
  status: FinalizedExerciseAttemptStatus;
  tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
}) {
  const [setAttempt, tryoutAttempt] = await Promise.all([
    ctx.db.get("exerciseAttempts", partAttempt.setAttemptId),
    ctx.db.get("tryoutAttempts", tryoutAttemptId),
  ]);

  if (!setAttempt) {
    throw new ConvexError({
      code: "SET_ATTEMPT_NOT_FOUND",
      message: "Exercise set attempt not found.",
    });
  }

  if (!tryoutAttempt) {
    throw new ConvexError({
      code: "ATTEMPT_NOT_FOUND",
      message: "Tryout attempt not found.",
    });
  }

  const isAlreadyFinalized = tryoutAttempt.completedPartIndices.includes(
    partAttempt.partIndex
  );
  let currentSetAttempt = setAttempt;

  if (setAttempt.status === "in-progress") {
    if (setAttempt.schedulerId) {
      await ctx.scheduler.cancel(setAttempt.schedulerId);
    }

    const setExpiresAtMs = setAttempt.startedAt + setAttempt.timeLimit * 1000;
    const completedAt = Math.min(finishedAtMs, setExpiresAtMs);
    let finalStatus: FinalizedExerciseAttemptStatus = "completed";

    if (status === "expired" || finishedAtMs >= setExpiresAtMs) {
      finalStatus = "expired";
    }

    const totalTime = computeAttemptDurationSeconds({
      startedAtMs: setAttempt.startedAt,
      completedAtMs: completedAt,
    });

    currentSetAttempt = {
      ...setAttempt,
      completedAt,
      endReason: getAttemptEndReasonFromStatus(finalStatus),
      lastActivityAt: now,
      status: finalStatus,
      totalTime,
      updatedAt: now,
    };

    await ctx.db.patch(
      "exerciseAttempts",
      setAttempt._id,
      buildFinalizedExerciseAttemptPatch({
        completedAtMs: completedAt,
        now,
        status: finalStatus,
        totalTime,
      })
    );
  }

  if (isAlreadyFinalized) {
    return {
      rawScore: currentSetAttempt.correctAnswers,
      theta: partAttempt.theta,
      thetaSE: partAttempt.thetaSE,
      totalQuestions: currentSetAttempt.totalExercises,
    };
  }

  const [answers, itemParamsRecords] = await Promise.all([
    getBoundedExerciseAnswers(ctx.db, {
      attemptId: partAttempt.setAttemptId,
      totalExercises: currentSetAttempt.totalExercises,
    }),
    getScaleVersionItemsForSet(ctx.db, {
      scaleVersionId: tryoutAttempt.scaleVersionId,
      setId: partAttempt.setId,
    }),
  ]);
  const itemResponses = buildOperationalIrtResponses({
    answers,
    itemParamsRecords,
  });
  const { theta, se } = estimateThetaEAP(itemResponses);
  const rawScore = countCorrectAnswers(answers);
  const completedPartIndices = [...tryoutAttempt.completedPartIndices];

  if (!completedPartIndices.includes(partAttempt.partIndex)) {
    completedPartIndices.push(partAttempt.partIndex);
    completedPartIndices.sort((left, right) => left - right);
  }

  await Promise.all([
    ctx.db.patch("tryoutPartAttempts", partAttempt._id, {
      theta,
      thetaSE: se,
    }),
    ctx.db.patch("tryoutAttempts", tryoutAttempt._id, {
      completedPartIndices,
      lastActivityAt: now,
    }),
    ctx.db.insert("irtCalibrationQueue", {
      setId: partAttempt.setId,
      enqueuedAt: now,
    }),
  ]);

  return {
    rawScore,
    theta,
    thetaSE: se,
    totalQuestions: currentSetAttempt.totalExercises,
  };
}

/**
 * Recompute the persisted tryout aggregate fields from finalized part attempts.
 *
 * This helper intentionally re-reads every finalized part, rebuilds the full
 * IRT response set, then overwrites the parent attempt's derived totals and
 * score fields in one patch. Optional `scaleVersionId` / `scoreStatus`
 * overrides are used when promoting provisional attempts to an official scale.
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
  ctx: Pick<MutationCtx, "db" | "scheduler">;
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
  const partData = await asyncMap(
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

      return {
        answers,
        itemParamsRecords,
        totalQuestions: setAttempt.totalExercises,
      };
    }
  );
  const allResponses = partData.flatMap((part) =>
    buildOperationalIrtResponses(part)
  );
  const totalCorrect = partData.reduce(
    (count, part) => count + countCorrectAnswers(part.answers),
    0
  );
  const totalQuestions = partData.reduce(
    (count, part) => count + part.totalQuestions,
    0
  );
  const { theta, se } = estimateThetaEAP(allResponses);
  const irtScore =
    tryoutProductPolicies[tryout.product].scaleThetaToScore(theta);

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
