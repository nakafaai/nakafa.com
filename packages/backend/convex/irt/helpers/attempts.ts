import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { irtCalibrationSyncWorkpool } from "@repo/backend/convex/irt/workpool";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const MAX_CALIBRATION_ATTEMPT_DUPLICATES = 100;

/**
 * Remove every cached calibration row tied to one exercise attempt and keep the
 * per-set cache stats in sync.
 */
export async function clearCalibrationResponsesForAttempt(
  ctx: MutationCtx,
  args: {
    attemptId: Id<"exerciseAttempts">;
    updatedAt: number;
  }
) {
  const existingAttempts = await ctx.db
    .query("irtCalibrationAttempts")
    .withIndex("by_attemptId", (q) => q.eq("attemptId", args.attemptId))
    .take(MAX_CALIBRATION_ATTEMPT_DUPLICATES + 1);

  if (existingAttempts.length > MAX_CALIBRATION_ATTEMPT_DUPLICATES) {
    throw new ConvexError({
      code: "IRT_CALIBRATION_ATTEMPT_DUPLICATE_LIMIT_EXCEEDED",
      message: "Too many cached calibration rows exist for one attempt.",
    });
  }

  const removedAttemptCounts = new Map<Id<"exerciseSets">, number>();

  for (const calibrationAttempt of existingAttempts) {
    const nextCount =
      (removedAttemptCounts.get(calibrationAttempt.setId) ?? 0) + 1;
    removedAttemptCounts.set(calibrationAttempt.setId, nextCount);
  }

  for (const calibrationAttempt of existingAttempts) {
    await ctx.db.delete("irtCalibrationAttempts", calibrationAttempt._id);
  }

  for (const [setId] of removedAttemptCounts) {
    await irtCalibrationSyncWorkpool.enqueueMutation(
      ctx,
      internal.irt.mutations.internal.cache.rebuildCalibrationCacheStatsForSet,
      { setId }
    );
  }

  return null;
}

/**
 * Build one normalized calibration cache row from the authoritative scored
 * answers of a completed simulation set attempt.
 */
export async function buildCalibrationAttemptInsert(
  ctx: MutationCtx,
  attemptId: Id<"exerciseAttempts">
) {
  const attempt = await ctx.db.get("exerciseAttempts", attemptId);

  if (
    !attempt ||
    attempt.scope !== "set" ||
    attempt.mode !== "simulation" ||
    attempt.status !== "completed"
  ) {
    return null;
  }

  const answers = await ctx.db
    .query("exerciseAnswers")
    .withIndex("by_attemptId_and_exerciseNumber", (q) =>
      q.eq("attemptId", attemptId)
    )
    .take(attempt.totalExercises + 1);

  if (answers.length > attempt.totalExercises) {
    throw new ConvexError({
      code: "IRT_ATTEMPT_ANSWER_COUNT_EXCEEDED",
      message: "Exercise answer count exceeds the attempt total exercises.",
    });
  }

  const scoredAnswers = answers.flatMap((answer) => {
    if (answer.questionId === undefined) {
      return [];
    }

    return [
      {
        isCorrect: answer.isCorrect,
        questionId: answer.questionId,
      },
    ];
  });

  if (scoredAnswers.length === 0) {
    return null;
  }

  const questions = await getAll(
    ctx.db,
    "exerciseQuestions",
    scoredAnswers.map((answer) => answer.questionId)
  );
  const firstQuestion = questions[0];

  if (!firstQuestion) {
    throw new ConvexError({
      code: "IRT_QUESTION_NOT_FOUND",
      message: "Calibration response is missing its exercise question.",
    });
  }

  const setId = firstQuestion.setId;
  const responses = scoredAnswers.map((answer, index) => {
    const question = questions[index];

    if (!question) {
      throw new ConvexError({
        code: "IRT_QUESTION_NOT_FOUND",
        message: "Calibration response is missing its exercise question.",
      });
    }

    if (question.setId !== setId) {
      throw new ConvexError({
        code: "IRT_MULTIPLE_SETS_IN_ATTEMPT",
        message: "Calibration attempt contains answers from multiple sets.",
      });
    }

    return {
      questionId: question._id,
      isCorrect: answer.isCorrect,
    };
  });

  return {
    responses,
    setId,
  };
}

/** Insert one normalized calibration cache row and update its per-set stats. */
export async function insertCalibrationAttempt(
  ctx: MutationCtx,
  args: {
    attemptId: Id<"exerciseAttempts">;
    responses: Array<{
      isCorrect: boolean;
      questionId: Id<"exerciseQuestions">;
    }>;
    setId: Id<"exerciseSets">;
    updatedAt: number;
  }
) {
  await ctx.db.insert("irtCalibrationAttempts", {
    setId: args.setId,
    attemptId: args.attemptId,
    responses: args.responses,
  });

  await irtCalibrationSyncWorkpool.enqueueMutation(
    ctx,
    internal.irt.mutations.internal.cache.rebuildCalibrationCacheStatsForSet,
    { setId: args.setId }
  );

  return null;
}
