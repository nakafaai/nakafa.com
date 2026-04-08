import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  buildFinalizedExerciseAttemptPatch,
  computeAttemptDurationSeconds,
} from "@repo/backend/convex/exercises/utils";
import { getScaleVersionItemsForSet } from "@repo/backend/convex/irt/scales/read";
import { getAttemptEndReasonFromStatus } from "@repo/backend/convex/lib/attempts";
import { scoreFinalizedTryoutPart } from "@repo/backend/convex/tryouts/helpers/finalize/score";
import { getBoundedExerciseAnswers } from "@repo/backend/convex/tryouts/helpers/loaders";
import { ConvexError } from "convex/values";

type FinalizedExerciseAttemptStatus = Exclude<
  Doc<"exerciseAttempts">["status"],
  "in-progress"
>;

async function finalizeExerciseSetAttemptIfNeeded(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  {
    finishedAtMs,
    now,
    setAttempt,
    status,
  }: {
    finishedAtMs: number;
    now: number;
    setAttempt: Doc<"exerciseAttempts">;
    status: FinalizedExerciseAttemptStatus;
  }
) {
  if (setAttempt.status !== "in-progress") {
    return setAttempt;
  }

  if (setAttempt.schedulerId) {
    await ctx.scheduler.cancel(setAttempt.schedulerId);
  }

  const setExpiresAtMs = setAttempt.startedAt + setAttempt.timeLimit * 1000;
  const completedAt = Math.min(finishedAtMs, setExpiresAtMs);
  const finalStatus: FinalizedExerciseAttemptStatus =
    status === "expired" || finishedAtMs >= setExpiresAtMs
      ? "expired"
      : "completed";
  const totalTime = computeAttemptDurationSeconds({
    startedAtMs: setAttempt.startedAt,
    completedAtMs: completedAt,
  });
  const finalizedSetAttempt = {
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

  return finalizedSetAttempt;
}

/**
 * Finalize one started tryout part from its persisted exercise answers.
 *
 * This mutation-side helper only owns one part lifecycle: it reconciles the
 * backing exercise attempt, scores the finalized part with the frozen tryout
 * scale, patches the part snapshot, and marks the part complete on the parent
 * tryout attempt.
 */
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
  const currentSetAttempt = await finalizeExerciseSetAttemptIfNeeded(ctx, {
    finishedAtMs,
    now,
    setAttempt,
    status,
  });

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
      questionCount: currentSetAttempt.totalExercises,
      scaleVersionId: tryoutAttempt.scaleVersionId,
      setId: partAttempt.setId,
    }),
  ]);
  const partScore = scoreFinalizedTryoutPart({
    answers,
    itemParamsRecords,
    totalQuestions: currentSetAttempt.totalExercises,
  });
  const completedPartIndices = [...tryoutAttempt.completedPartIndices];

  if (!completedPartIndices.includes(partAttempt.partIndex)) {
    completedPartIndices.push(partAttempt.partIndex);
    completedPartIndices.sort((left, right) => left - right);
  }

  await Promise.all([
    ctx.db.patch("tryoutPartAttempts", partAttempt._id, {
      theta: partScore.theta,
      thetaSE: partScore.thetaSE,
    }),
    ctx.db.patch("tryoutAttempts", tryoutAttempt._id, {
      completedPartIndices,
      lastActivityAt: now,
    }),
  ]);

  return {
    rawScore: partScore.rawScore,
    theta: partScore.theta,
    thetaSE: partScore.thetaSE,
    totalQuestions: partScore.totalQuestions,
  };
}
