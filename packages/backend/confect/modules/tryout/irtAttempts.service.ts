import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import {
  adjustCalibrationCacheAttemptCount,
  scheduleCalibrationCacheStatsRebuild,
} from "@repo/backend/confect/modules/tryout/irtCache.service";
import { getAll } from "convex-helpers/server/relationships";
import { Effect } from "effect";

const MAX_CALIBRATION_ATTEMPT_DUPLICATES = 100;

/** Deletes cached calibration rows for one exercise attempt. */
export const clearCalibrationResponsesForAttempt = Effect.fn(
  "irt.attempts.clearCalibrationResponsesForAttempt"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly attemptId: Id<"exerciseAttempts">;
    readonly updatedAt: number;
  }
) {
  const existingAttempts = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_attemptId", (query) =>
        query.eq("attemptId", args.attemptId)
      )
      .take(MAX_CALIBRATION_ATTEMPT_DUPLICATES + 1)
  );

  if (existingAttempts.length > MAX_CALIBRATION_ATTEMPT_DUPLICATES) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_CALIBRATION_ATTEMPT_DUPLICATE_LIMIT_EXCEEDED",
        message: "Too many cached calibration rows exist for one attempt.",
      })
    );
  }

  const removedAttemptCounts = new Map<Id<"exerciseSets">, number>();

  for (const calibrationAttempt of existingAttempts) {
    const nextCount =
      (removedAttemptCounts.get(calibrationAttempt.setId) ?? 0) + 1;
    removedAttemptCounts.set(calibrationAttempt.setId, nextCount);
  }

  for (const calibrationAttempt of existingAttempts) {
    yield* Effect.promise(() => ctx.db.delete(calibrationAttempt._id));
  }

  for (const [setId, removedCount] of removedAttemptCounts) {
    const didAdjustStats = yield* adjustCalibrationCacheAttemptCount(ctx, {
      delta: -removedCount,
      setId,
      updatedAt: args.updatedAt,
    });

    if (didAdjustStats) {
      continue;
    }

    yield* scheduleCalibrationCacheStatsRebuild(ctx, setId);
  }

  return null;
});

/** Builds a calibration cache insert from a completed simulation attempt. */
export const buildCalibrationAttemptInsert = Effect.fn(
  "irt.attempts.buildCalibrationAttemptInsert"
)(function* (ctx: ConvexMutationCtx, attemptId: Id<"exerciseAttempts">) {
  const attempt = yield* Effect.promise(() => ctx.db.get(attemptId));

  if (
    !attempt ||
    attempt.scope !== "set" ||
    attempt.mode !== "simulation" ||
    attempt.status !== "completed"
  ) {
    return null;
  }

  const answers = yield* Effect.promise(() =>
    ctx.db
      .query("exerciseAnswers")
      .withIndex("by_attemptId_and_exerciseNumber", (query) =>
        query.eq("attemptId", attemptId)
      )
      .take(attempt.totalExercises + 1)
  );

  if (answers.length > attempt.totalExercises) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_ATTEMPT_ANSWER_COUNT_EXCEEDED",
        message: "Exercise answer count exceeds the attempt total exercises.",
      })
    );
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

  const questions = yield* Effect.promise(() =>
    getAll(
      ctx.db,
      "exerciseQuestions",
      scoredAnswers.map((answer) => answer.questionId)
    )
  );
  const firstQuestion = questions[0];

  if (!firstQuestion) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_QUESTION_NOT_FOUND",
        message: "Calibration response is missing its exercise question.",
      })
    );
  }

  const setId = firstQuestion.setId;
  const responses = yield* Effect.forEach(
    Array.from(scoredAnswers.entries()),
    ([index, answer]) =>
      Effect.gen(function* () {
        const question = questions[index];

        if (!question) {
          return yield* Effect.fail(
            new IrtError({
              code: "IRT_QUESTION_NOT_FOUND",
              message: "Calibration response is missing its exercise question.",
            })
          );
        }

        if (question.setId !== setId) {
          return yield* Effect.fail(
            new IrtError({
              code: "IRT_MULTIPLE_SETS_IN_ATTEMPT",
              message:
                "Calibration attempt contains answers from multiple sets.",
            })
          );
        }

        return {
          isCorrect: answer.isCorrect,
          questionId: question._id,
        };
      })
  );

  return { responses, setId };
});

/** Inserts one calibration cache row and updates cache stats. */
export const insertCalibrationAttempt = Effect.fn(
  "irt.attempts.insertCalibrationAttempt"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly attemptId: Id<"exerciseAttempts">;
    readonly responses: readonly {
      readonly isCorrect: boolean;
      readonly questionId: Id<"exerciseQuestions">;
    }[];
    readonly setId: Id<"exerciseSets">;
    readonly updatedAt: number;
  }
) {
  yield* Effect.promise(() =>
    ctx.db.insert("irtCalibrationAttempts", {
      attemptId: args.attemptId,
      responses: [...args.responses],
      setId: args.setId,
    })
  );

  const didAdjustStats = yield* adjustCalibrationCacheAttemptCount(ctx, {
    delta: 1,
    setId: args.setId,
    updatedAt: args.updatedAt,
  });

  if (!didAdjustStats) {
    yield* scheduleCalibrationCacheStatsRebuild(ctx, args.setId);
  }

  return null;
});
