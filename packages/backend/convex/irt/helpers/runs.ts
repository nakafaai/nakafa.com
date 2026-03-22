import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import type { Infer } from "convex/values";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";

const MAX_AFFECTED_TRYOUTS_PER_SET = 100;

/** Persists calibrated item parameters and queues any affected tryout publication. */
export async function completeCalibrationRunHandler(
  ctx: MutationCtx,
  args: {
    calibrationRunId: Id<"irtCalibrationRuns">;
    result: Infer<typeof irtCalibrationResultValidator>;
  }
) {
  const now = Date.now();
  const run = await ctx.db.get("irtCalibrationRuns", args.calibrationRunId);

  if (!run) {
    throw new ConvexError({
      code: "IRT_CALIBRATION_RUN_NOT_FOUND",
      message: "Calibration run not found.",
    });
  }

  const existingParams = await ctx.db
    .query("exerciseItemParameters")
    .withIndex("by_setId", (q) => q.eq("setId", run.setId))
    .take(run.questionCount + 1);

  if (existingParams.length > run.questionCount) {
    throw new ConvexError({
      code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
      message: "Exercise item parameter count exceeds the set question count.",
    });
  }

  const existingParamsByQuestionId = new Map(
    existingParams.map((params) => [params.questionId, params])
  );

  await asyncMap(args.result.items, async (item) => {
    const existingItemParams = existingParamsByQuestionId.get(item.questionId);
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
      return;
    }

    await ctx.db.insert("exerciseItemParameters", {
      questionId: item.questionId,
      ...nextValues,
    });
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
    .withIndex("setId", (q) => q.eq("setId", run.setId))
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

      return null;
    }
  );

  await ctx.scheduler.runAfter(
    0,
    internal.irt.internalMutations.cleanupCalibrationQueueEntries,
    {
      setId: run.setId,
      throughAt: run.startedAt,
    }
  );

  return null;
}

/** Marks one calibration run failed and keeps its set eligible for retry. */
export async function failCalibrationRunHandler(
  ctx: MutationCtx,
  args: {
    calibrationRunId: Id<"irtCalibrationRuns">;
    error: string;
  }
) {
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
}
