import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  buildFinalizedExerciseAttemptPatch,
  computeAttemptDurationSeconds,
} from "@repo/backend/convex/exercises/utils";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import { getScaleVersionItemsForSet } from "@repo/backend/convex/irt/scaleVersions";
import { getAttemptEndReasonFromStatus } from "@repo/backend/convex/lib/attempts";
import {
  computeTryoutExpiresAtMs,
  scaleThetaToTryoutScore,
} from "@repo/backend/convex/tryouts/products";
import type { TryoutScoreStatus } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";
import {
  getAll,
  getManyFrom,
  getOneFrom,
} from "convex-helpers/server/relationships";

type TryoutMutationCtx = Pick<MutationCtx, "db" | "scheduler">;
type TryoutDbReader = QueryCtx["db"];
type TryoutScoreTotals = Pick<
  Doc<"tryoutAttempts">,
  "totalCorrect" | "totalQuestions"
>;

export function getTryoutAttemptScoreStatus(
  tryoutAttempt: Pick<Doc<"tryoutAttempts">, "scoreStatus">
) {
  return tryoutAttempt.scoreStatus;
}
type FinalizedExerciseAttemptStatus = Exclude<
  Doc<"exerciseAttempts">["status"],
  "in-progress"
>;
type FinalizedTryoutStatus = Exclude<
  Doc<"tryoutAttempts">["status"],
  "in-progress"
>;

/** Converts accumulated tryout score totals into a percentage. */
export function computeTryoutRawScorePercentage({
  totalCorrect,
  totalQuestions,
}: TryoutScoreTotals) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return (totalCorrect / totalQuestions) * 100;
}

/** Returns the first ordered part index that has not been finalized yet. */
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

/** Returns the earliest completed simulation attempt for official-result checks. */
export function getFirstCompletedSimulationAttempt(
  db: TryoutDbReader,
  { userId, tryoutId }: Pick<Doc<"tryoutAttempts">, "userId" | "tryoutId">
) {
  return db
    .query("tryoutAttempts")
    .withIndex("userId_tryoutId_status_startedAt", (q) =>
      q.eq("userId", userId).eq("tryoutId", tryoutId).eq("status", "completed")
    )
    .order("asc")
    .first();
}

/** Counts correct answers from the shared exercise-attempt answer rows. */
export function countCorrectAnswers(answers: Doc<"exerciseAnswers">[]) {
  return answers.reduce(
    (correctCount, answer) => correctCount + (answer.isCorrect ? 1 : 0),
    0
  );
}

/**
 * Builds the operational person-scoring payload from frozen tryout item params.
 *
 * Unanswered items inside a timed tryout are treated as incorrect here so the
 * operational IRT score reflects the full administered form, not only the
 * subset of items the student answered. See `convex/irt/README.md` for the
 * documented rationale and source links.
 */
export function buildOperationalIrtResponses({
  answers,
  itemParamsRecords,
}: {
  answers: Doc<"exerciseAnswers">[];
  itemParamsRecords: Pick<
    Doc<"exerciseItemParameters">,
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
    getManyFrom(
      ctx.db,
      "exerciseAnswers",
      "attemptId_exerciseNumber",
      partAttempt.setAttemptId,
      "attemptId"
    ),
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
  const effectiveScoreStatus =
    scoreStatus ?? getTryoutAttemptScoreStatus(tryoutAttempt);
  const completedPartIndices = new Set(tryoutAttempt.completedPartIndices);
  const partAttempts = await getManyFrom(
    ctx.db,
    "tryoutPartAttempts",
    "tryoutAttemptId_partIndex",
    tryoutAttemptId,
    "tryoutAttemptId"
  );
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
        getManyFrom(
          ctx.db,
          "exerciseAnswers",
          "attemptId_exerciseNumber",
          partAttempt.setAttemptId,
          "attemptId"
        ),
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
  const irtScore = scaleThetaToTryoutScore({
    product: tryout.product,
    theta,
  });

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

/** Re-score one terminal tryout attempt against a newer frozen scale. */
export function rescoreTryoutAttempt({
  ctx,
  now,
  scaleVersionId,
  scoreStatus,
  tryoutAttempt,
}: {
  ctx: TryoutMutationCtx;
  now: number;
  scaleVersionId: Doc<"tryoutAttempts">["scaleVersionId"];
  scoreStatus: TryoutScoreStatus;
  tryoutAttempt: Doc<"tryoutAttempts">;
}) {
  if (tryoutAttempt.status === "in-progress") {
    return null;
  }

  return syncTryoutAttemptAggregates({
    completedAtMs: tryoutAttempt.completedAt ?? now,
    ctx,
    now,
    scaleVersionId,
    scoreStatus,
    status: tryoutAttempt.status,
    tryoutAttemptId: tryoutAttempt._id,
  });
}

/** Expires a tryout and every still-open shared set attempt under it. */
export async function expireTryoutAttempt(
  ctx: TryoutMutationCtx,
  tryoutAttempt: Doc<"tryoutAttempts">,
  now: number
) {
  const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

  if (!tryout) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout attempt is missing its parent tryout.",
    });
  }

  const expiredAtMs = computeTryoutExpiresAtMs({
    product: tryout.product,
    startedAtMs: tryoutAttempt.startedAt,
  });

  const partAttempts = await getManyFrom(
    ctx.db,
    "tryoutPartAttempts",
    "tryoutAttemptId_partIndex",
    tryoutAttempt._id,
    "tryoutAttemptId"
  );
  for (const partAttempt of partAttempts) {
    if (tryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)) {
      continue;
    }

    await finalizeTryoutPartAttempt({
      ctx,
      finishedAtMs: expiredAtMs,
      now,
      partAttempt,
      status: "expired",
      tryoutAttemptId: tryoutAttempt._id,
    });
  }

  await syncTryoutAttemptAggregates({
    completedAtMs: expiredAtMs,
    ctx,
    now,
    status: "expired",
    tryoutAttemptId: tryoutAttempt._id,
  });

  return expiredAtMs;
}

/** Reconciles one tryout attempt against its derived expiry window. */
export async function syncTryoutAttemptExpiry(
  ctx: TryoutMutationCtx,
  tryoutAttempt: Doc<"tryoutAttempts">,
  now: number
) {
  const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

  if (!tryout) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout attempt is missing its parent tryout.",
    });
  }

  const expiredAtMs = computeTryoutExpiresAtMs({
    product: tryout.product,
    startedAtMs: tryoutAttempt.startedAt,
  });

  if (tryoutAttempt.status === "expired") {
    return { expired: true, expiredAtMs };
  }

  if (tryoutAttempt.status === "in-progress" && now >= expiredAtMs) {
    await expireTryoutAttempt(ctx, tryoutAttempt, now);
    return { expired: true, expiredAtMs };
  }

  return { expired: false, expiredAtMs };
}

/** Reconciles a shared exercise attempt that belongs to a tryout part. */
export async function syncTryoutExerciseAttemptExpiry(
  ctx: TryoutMutationCtx,
  attempt: Doc<"exerciseAttempts">,
  now: number
) {
  if (attempt.origin !== "tryout") {
    return { expired: false, expiredAtMs: undefined };
  }

  const partAttempt = await getOneFrom(
    ctx.db,
    "tryoutPartAttempts",
    "setAttemptId",
    attempt._id
  );

  if (!partAttempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout exercise attempt is missing its part attempt mapping.",
    });
  }

  const tryoutAttempt = await ctx.db.get(
    "tryoutAttempts",
    partAttempt.tryoutAttemptId
  );

  if (!tryoutAttempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout exercise attempt is missing its parent tryout attempt.",
    });
  }

  const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

  if (!tryoutExpiry.expired) {
    return { expired: false, expiredAtMs: tryoutExpiry.expiredAtMs };
  }

  return { expired: true, expiredAtMs: tryoutExpiry.expiredAtMs };
}
