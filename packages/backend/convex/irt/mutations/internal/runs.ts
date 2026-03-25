import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalMutation } from "@repo/backend/convex/functions";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";
import { asyncMap } from "convex-helpers";

const MAX_AFFECTED_TRYOUTS_PER_SET = 100;

/**
 * Persist calibrated item parameters, mark the run complete, and enqueue any
 * affected tryouts for scale publication and quality refresh.
 */
export const completeCalibrationRun = internalMutation({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    result: irtCalibrationResultValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const run = await ctx.db.get("irtCalibrationRuns", args.calibrationRunId);

    if (!run) {
      throw new ConvexError({
        code: "IRT_CALIBRATION_RUN_NOT_FOUND",
        message: "Calibration run not found.",
      });
    }

    const questions = await ctx.db
      .query("exerciseQuestions")
      .withIndex("by_setId", (q) => q.eq("setId", run.setId))
      .take(run.questionCount + 1);

    if (questions.length > run.questionCount) {
      throw new ConvexError({
        code: "IRT_QUESTION_COUNT_EXCEEDED",
        message:
          "Exercise question count exceeds the calibration run question count.",
      });
    }

    if (args.result.items.length > run.questionCount) {
      throw new ConvexError({
        code: "IRT_RESULT_ITEM_COUNT_EXCEEDED",
        message:
          "Calibration result item count exceeds the calibration run question count.",
      });
    }

    const validQuestionIds = new Set(questions.map((question) => question._id));
    const seenQuestionIds = new Set<Id<"exerciseQuestions">>();

    for (const item of args.result.items) {
      if (!validQuestionIds.has(item.questionId)) {
        throw new ConvexError({
          code: "IRT_RESULT_QUESTION_NOT_IN_SET",
          message:
            "Calibration result references a question outside the exercise set.",
        });
      }

      if (seenQuestionIds.has(item.questionId)) {
        throw new ConvexError({
          code: "IRT_RESULT_DUPLICATE_QUESTION",
          message: "Calibration result contains duplicate question parameters.",
        });
      }

      seenQuestionIds.add(item.questionId);
    }

    if (args.result.questionCount !== questions.length) {
      throw new ConvexError({
        code: "IRT_RESULT_QUESTION_COUNT_MISMATCH",
        message:
          "Calibration result question count does not match the exercise set.",
      });
    }

    if (args.result.attemptCount > args.result.responseCount) {
      throw new ConvexError({
        code: "IRT_RESULT_ATTEMPT_COUNT_EXCEEDED",
        message: "Calibration result attempt count exceeds the response count.",
      });
    }

    if (
      args.result.responseCount >
      args.result.attemptCount * run.questionCount
    ) {
      throw new ConvexError({
        code: "IRT_RESULT_RESPONSE_COUNT_EXCEEDED",
        message:
          "Calibration result response count exceeds the set response limit.",
      });
    }

    const existingParams = await ctx.db
      .query("exerciseItemParameters")
      .withIndex("by_setId", (q) => q.eq("setId", run.setId))
      .take(run.questionCount + 1);

    if (existingParams.length > run.questionCount) {
      throw new ConvexError({
        code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
        message:
          "Exercise item parameter count exceeds the set question count.",
      });
    }

    const existingParamsByQuestionId = new Map(
      existingParams.map((params) => [params.questionId, params])
    );

    await asyncMap(args.result.items, async (item) => {
      const existingItemParams = existingParamsByQuestionId.get(
        item.questionId
      );
      const nextValues = {
        setId: run.setId,
        difficulty: item.difficulty,
        discrimination: item.discrimination,
        responseCount: item.responseCount,
        correctRate: item.correctRate,
        calibratedAt: now,
        calibrationStatus: item.calibrationStatus,
        calibrationRunId: args.calibrationRunId,
      };

      if (existingItemParams) {
        await ctx.db.patch(
          "exerciseItemParameters",
          existingItemParams._id,
          nextValues
        );
        return null;
      }

      await ctx.db.insert("exerciseItemParameters", {
        questionId: item.questionId,
        ...nextValues,
      });

      return null;
    });

    await ctx.db.patch("irtCalibrationRuns", args.calibrationRunId, {
      status: "completed",
      responseCount: args.result.responseCount,
      attemptCount: args.result.attemptCount,
      questionCount: args.result.questionCount,
      iterationCount: args.result.iterationCount,
      maxParameterDelta: args.result.maxParameterDelta,
      completedAt: now,
      updatedAt: now,
      error: undefined,
    });

    const affectedTryoutSets = await ctx.db
      .query("tryoutPartSets")
      .withIndex("by_setId", (q) => q.eq("setId", run.setId))
      .take(MAX_AFFECTED_TRYOUTS_PER_SET + 1);

    if (affectedTryoutSets.length > MAX_AFFECTED_TRYOUTS_PER_SET) {
      throw new ConvexError({
        code: "IRT_AFFECTED_TRYOUT_LIMIT_EXCEEDED",
        message: "Too many tryouts reference one calibrated set.",
      });
    }

    await asyncMap(
      [...new Set(affectedTryoutSets.map((tryoutSet) => tryoutSet.tryoutId))],
      async (tryoutId) => {
        const existingQueueEntry = await ctx.db
          .query("irtScalePublicationQueue")
          .withIndex("by_tryoutId_and_enqueuedAt", (q) =>
            q.eq("tryoutId", tryoutId)
          )
          .first();

        if (!existingQueueEntry) {
          await ctx.db.insert("irtScalePublicationQueue", {
            tryoutId,
            enqueuedAt: now,
          });
        }

        await ctx.scheduler.runAfter(
          0,
          internal.irt.mutations.internal.scales.refreshScaleQualityCheck,
          { tryoutId }
        );

        return null;
      }
    );

    await ctx.scheduler.runAfter(
      0,
      internal.irt.mutations.internal.queue.cleanupCalibrationQueueEntries,
      {
        setId: run.setId,
        throughAt: run.startedAt,
      }
    );

    return null;
  },
});

/** Mark one calibration run failed and requeue its set if needed. */
export const failCalibrationRun = internalMutation({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("irtCalibrationRuns", args.calibrationRunId);

    if (!run) {
      throw new ConvexError({
        code: "IRT_CALIBRATION_RUN_NOT_FOUND",
        message: "Calibration run not found.",
      });
    }

    await ctx.db.patch("irtCalibrationRuns", args.calibrationRunId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });

    const existingQueueEntry = await ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_setId_and_enqueuedAt", (q) => q.eq("setId", run.setId))
      .first();

    if (!existingQueueEntry) {
      await ctx.db.insert("irtCalibrationQueue", {
        setId: run.setId,
        enqueuedAt: Date.now(),
      });
    }

    return null;
  },
});
