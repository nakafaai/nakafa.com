import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { irtScalePublicationQueueWorkpool } from "@repo/backend/confect/modules/tryout/irtWorkpool";
import { Clock, Effect } from "effect";

const MAX_AFFECTED_TRYOUTS_PER_SET = 100;

interface CalibrationItem {
  readonly calibrationStatus: "calibrated" | "emerging" | "provisional";
  readonly correctRate: number;
  readonly difficulty: number;
  readonly discrimination: number;
  readonly questionId: Id<"exerciseQuestions">;
  readonly responseCount: number;
}

interface CalibrationResult {
  readonly attemptCount: number;
  readonly items: readonly CalibrationItem[];
  readonly iterationCount: number;
  readonly maxParameterDelta: number;
  readonly model: "2pl";
  readonly questionCount: number;
  readonly responseCount: number;
}

/** Completes a calibration run and writes item parameters atomically. */
export const completeCalibrationRun = Effect.fn(
  "irt.runs.completeCalibrationRun"
)(function* (args: {
  readonly calibrationRunId: Id<"irtCalibrationRuns">;
  readonly result: CalibrationResult;
}) {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;
  const run = yield* Effect.promise(() => ctx.db.get(args.calibrationRunId));

  if (!run) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_CALIBRATION_RUN_NOT_FOUND",
        message: "Calibration run not found.",
      })
    );
  }

  const questions = yield* Effect.promise(() =>
    ctx.db
      .query("exerciseQuestions")
      .withIndex("by_setId", (query) => query.eq("setId", run.setId))
      .take(run.questionCount + 1)
  );

  if (questions.length > run.questionCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_QUESTION_COUNT_EXCEEDED",
        message:
          "Exercise question count exceeds the calibration run question count.",
      })
    );
  }

  if (args.result.items.length > run.questionCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_RESULT_ITEM_COUNT_EXCEEDED",
        message:
          "Calibration result item count exceeds the calibration run question count.",
      })
    );
  }

  const validQuestionIds = new Set(questions.map((question) => question._id));
  const seenQuestionIds = new Set<Id<"exerciseQuestions">>();

  for (const item of args.result.items) {
    if (!validQuestionIds.has(item.questionId)) {
      return yield* Effect.fail(
        new IrtError({
          code: "IRT_RESULT_QUESTION_NOT_IN_SET",
          message:
            "Calibration result references a question outside the exercise set.",
        })
      );
    }

    if (seenQuestionIds.has(item.questionId)) {
      return yield* Effect.fail(
        new IrtError({
          code: "IRT_RESULT_DUPLICATE_QUESTION",
          message: "Calibration result contains duplicate question parameters.",
        })
      );
    }

    seenQuestionIds.add(item.questionId);
  }

  if (args.result.questionCount !== questions.length) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_RESULT_QUESTION_COUNT_MISMATCH",
        message:
          "Calibration result question count does not match the exercise set.",
      })
    );
  }

  if (args.result.attemptCount > args.result.responseCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_RESULT_ATTEMPT_COUNT_EXCEEDED",
        message: "Calibration result attempt count exceeds the response count.",
      })
    );
  }

  if (
    args.result.responseCount >
    args.result.attemptCount * run.questionCount
  ) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_RESULT_RESPONSE_COUNT_EXCEEDED",
        message:
          "Calibration result response count exceeds the set response limit.",
      })
    );
  }

  const existingParams = yield* Effect.promise(() =>
    ctx.db
      .query("exerciseItemParameters")
      .withIndex("by_setId", (query) => query.eq("setId", run.setId))
      .take(run.questionCount + 1)
  );

  if (existingParams.length > run.questionCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
        message:
          "Exercise item parameter count exceeds the set question count.",
      })
    );
  }

  const existingParamsByQuestionId = new Map(
    existingParams.map((params) => [params.questionId, params])
  );

  for (const item of args.result.items) {
    const existingItemParams = existingParamsByQuestionId.get(item.questionId);
    const nextValues = {
      calibratedAt: now,
      calibrationRunId: args.calibrationRunId,
      calibrationStatus: item.calibrationStatus,
      correctRate: item.correctRate,
      difficulty: item.difficulty,
      discrimination: item.discrimination,
      responseCount: item.responseCount,
      setId: run.setId,
    };

    if (existingItemParams) {
      yield* Effect.promise(() =>
        ctx.db.patch(existingItemParams._id, nextValues)
      );
      continue;
    }

    yield* Effect.promise(() =>
      ctx.db.insert("exerciseItemParameters", {
        ...nextValues,
        questionId: item.questionId,
      })
    );
  }

  yield* Effect.promise(() =>
    ctx.db.patch(args.calibrationRunId, {
      attemptCount: args.result.attemptCount,
      completedAt: now,
      error: undefined,
      iterationCount: args.result.iterationCount,
      maxParameterDelta: args.result.maxParameterDelta,
      questionCount: args.result.questionCount,
      responseCount: args.result.responseCount,
      status: "completed",
      updatedAt: now,
    })
  );

  const affectedTryoutSets = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPartSets")
      .withIndex("by_setId", (query) => query.eq("setId", run.setId))
      .take(MAX_AFFECTED_TRYOUTS_PER_SET + 1)
  );

  if (affectedTryoutSets.length > MAX_AFFECTED_TRYOUTS_PER_SET) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_AFFECTED_TRYOUT_LIMIT_EXCEEDED",
        message: "Too many tryouts reference one calibrated set.",
      })
    );
  }

  for (const tryoutId of [
    ...new Set(affectedTryoutSets.map((tryoutSet) => tryoutSet.tryoutId)),
  ]) {
    yield* Effect.promise(() =>
      irtScalePublicationQueueWorkpool.enqueueMutation(
        ctx,
        Ref.getFunctionReference(
          refs.internal.irt.mutations.internalFunctions.queue
            .enqueueScalePublication
        ),
        { tryoutId }
      )
    );
  }

  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      Ref.getFunctionReference(
        refs.internal.irt.mutations.internalFunctions.queue
          .cleanupCalibrationQueueEntries
      ),
      {
        setId: run.setId,
        throughAt: run.startedAt,
      }
    )
  );

  return null;
});

/** Marks a calibration run as failed with a captured error message. */
export const failCalibrationRun = Effect.fn("irt.runs.failCalibrationRun")(
  function* (args: {
    readonly calibrationRunId: Id<"irtCalibrationRuns">;
    readonly error: string;
  }) {
    const ctx = yield* MutationCtx;
    const run = yield* Effect.promise(() => ctx.db.get(args.calibrationRunId));

    if (!run) {
      return yield* Effect.fail(
        new IrtError({
          code: "IRT_CALIBRATION_RUN_NOT_FOUND",
          message: "Calibration run not found.",
        })
      );
    }

    const updatedAt = yield* Clock.currentTimeMillis;
    yield* Effect.promise(() =>
      ctx.db.patch(args.calibrationRunId, {
        error: args.error,
        status: "failed",
        updatedAt,
      })
    );

    return null;
  }
);
