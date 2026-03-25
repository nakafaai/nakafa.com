import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  buildFinalizedExerciseAttemptPatch,
  computeAttemptDurationSeconds,
} from "@repo/backend/convex/exercises/utils";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import {
  getLatestScaleVersionForTryout,
  getScaleVersionItemsForSet,
} from "@repo/backend/convex/irt/scales/read";
import { getAttemptEndReasonFromStatus } from "@repo/backend/convex/lib/attempts";
import {
  countCorrectAnswers,
  getBoundedExerciseAnswers,
  loadBoundedTryoutPartAttempts,
} from "@repo/backend/convex/tryouts/helpers/loaders";
import type { TryoutMutationCtx } from "@repo/backend/convex/tryouts/helpers/types";
import { tryoutProductPolicies } from "@repo/backend/convex/tryouts/products";
import type { TryoutScoreStatus } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getAll } from "convex-helpers/server/relationships";

type TryoutDbReader = QueryCtx["db"];
type TryoutScoreTarget = Pick<
  Doc<"tryoutAttempts">,
  "scaleVersionId" | "scoreStatus"
>;
type TryoutScoreTotals = Pick<
  Doc<"tryoutAttempts">,
  "totalCorrect" | "totalQuestions"
>;
type FinalizedExerciseAttemptStatus = Exclude<
  Doc<"exerciseAttempts">["status"],
  "in-progress"
>;
type FinalizedTryoutStatus = Exclude<
  Doc<"tryoutAttempts">["status"],
  "in-progress"
>;

/** Pick the best frozen scale currently available for one tryout attempt. */
export async function getTryoutScoreTarget(
  db: TryoutDbReader,
  tryoutAttempt: Pick<
    Doc<"tryoutAttempts">,
    "_id" | "scaleVersionId" | "tryoutId"
  >
): Promise<TryoutScoreTarget> {
  const [currentScaleVersion, latestScaleVersion] = await Promise.all([
    db.get("irtScaleVersions", tryoutAttempt.scaleVersionId),
    getLatestScaleVersionForTryout(db, tryoutAttempt.tryoutId),
  ]);

  if (!currentScaleVersion) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout attempt is missing its scoring scale.",
    });
  }

  if (!latestScaleVersion || latestScaleVersion.status !== "official") {
    return {
      scaleVersionId: currentScaleVersion._id,
      scoreStatus: currentScaleVersion.status,
    };
  }

  return {
    scaleVersionId: latestScaleVersion._id,
    scoreStatus: "official",
  };
}

/** Convert accumulated tryout score totals into a percentage. */
export function computeTryoutRawScorePercentage({
  totalCorrect,
  totalQuestions,
}: TryoutScoreTotals) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return (totalCorrect / totalQuestions) * 100;
}

/** Return the first ordered part index that has not been finalized yet. */
export function getFirstIncompleteTryoutPartIndex({
  completedPartIndices,
  partCount,
}: Pick<Doc<"tryoutAttempts">, "completedPartIndices"> &
  Pick<Doc<"tryouts">, "partCount">) {
  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    if (!completedPartIndices.includes(partIndex)) {
      return partIndex;
    }
  }

  return undefined;
}

/** Break ties between two completed leaderboard scores. */
export function isBetterLeaderboardScore(
  candidate: Pick<Doc<"tryoutAttempts">, "completedAt" | "theta">,
  currentBest: Pick<Doc<"tryoutAttempts">, "completedAt" | "theta">
) {
  if (candidate.theta !== currentBest.theta) {
    return candidate.theta > currentBest.theta;
  }

  return (candidate.completedAt ?? 0) > (currentBest.completedAt ?? 0);
}

/**
 * Build the operational person-scoring payload from frozen tryout item params.
 *
 * Unanswered items inside a timed tryout are treated as incorrect here so the
 * operational IRT score reflects the full administered form.
 */
export function buildOperationalIrtResponses({
  answers,
  itemParamsRecords,
}: {
  answers: Doc<"exerciseAnswers">[];
  itemParamsRecords: Pick<
    Doc<"irtScaleVersionItems">,
    "questionId" | "difficulty" | "discrimination"
  >[];
}) {
  const answersByQuestionId = new Map<
    NonNullable<Doc<"exerciseAnswers">["questionId"]>,
    Doc<"exerciseAnswers">
  >();

  for (const answer of answers) {
    if (!answer.questionId) {
      continue;
    }

    answersByQuestionId.set(answer.questionId, answer);
  }

  return itemParamsRecords.map((itemParams) => ({
    correct: answersByQuestionId.get(itemParams.questionId)?.isCorrect ?? false,
    params: {
      difficulty: itemParams.difficulty,
      discrimination: itemParams.discrimination,
    },
  }));
}

/** Finalize one started tryout part from its persisted exercise answers. */
export async function finalizeTryoutPartAttempt({
  ctx,
  finishedAtMs,
  now,
  partAttempt,
  status,
  tryoutAttemptId,
}: {
  ctx: TryoutMutationCtx;
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

/** Recompute the persisted tryout aggregates from finalized part attempts. */
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
  ctx: TryoutMutationCtx;
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
