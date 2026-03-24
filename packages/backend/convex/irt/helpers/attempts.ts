import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { adjustCalibrationCacheAttemptCount } from "@repo/backend/convex/irt/helpers/cache";
import { IRT_CALIBRATION_RESPONSE_BACKFILL_BATCH_SIZE } from "@repo/backend/convex/irt/policy";
import { irtCalibrationSyncWorkpool } from "@repo/backend/convex/irt/workpool";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const MAX_CALIBRATION_ATTEMPT_DUPLICATES = 100;

/** Rebuilds one cached calibration row from a completed simulation attempt. */
export async function syncCalibrationResponsesForAttemptHandler(
  ctx: MutationCtx,
  args: {
    attemptId: Id<"exerciseAttempts">;
  }
) {
  const now = Date.now();
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

  for (const [setId, removedCount] of removedAttemptCounts) {
    const didAdjustStats = await adjustCalibrationCacheAttemptCount(ctx, {
      setId,
      delta: -removedCount,
      updatedAt: now,
    });

    if (didAdjustStats) {
      continue;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
      { setId }
    );
  }

  const attempt = await ctx.db.get("exerciseAttempts", args.attemptId);

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
      q.eq("attemptId", args.attemptId)
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

  await ctx.db.insert("irtCalibrationAttempts", {
    setId,
    attemptId: args.attemptId,
    responses,
  });

  const didAdjustStats = await adjustCalibrationCacheAttemptCount(ctx, {
    setId,
    delta: 1,
    updatedAt: now,
  });

  if (!didAdjustStats) {
    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
      { setId }
    );
  }

  return null;
}

/** Enqueues a bounded page of completed simulation attempts for cache backfill. */
export async function backfillCalibrationResponsesPageHandler(
  ctx: MutationCtx,
  args: {
    cursor?: string;
  }
) {
  const page = await ctx.db
    .query("exerciseAttempts")
    .withIndex("by_scope_and_mode_and_status_and_startedAt", (q) =>
      q.eq("scope", "set").eq("mode", "simulation").eq("status", "completed")
    )
    .paginate({
      cursor: args.cursor ?? null,
      numItems: IRT_CALIBRATION_RESPONSE_BACKFILL_BATCH_SIZE,
    });

  for (const attempt of page.page) {
    await irtCalibrationSyncWorkpool.enqueueMutation(
      ctx,
      internal.irt.internalMutations.syncCalibrationResponsesForAttempt,
      {
        attemptId: attempt._id,
      }
    );
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.backfillCalibrationResponsesPage,
      {
        cursor: page.continueCursor,
      }
    );
  }

  return {
    isDone: page.isDone,
    processedCount: page.page.length,
  };
}
