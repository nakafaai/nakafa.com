import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Create and start a tracked 2PL calibration run for one exercise set.
 */
export const startCalibrationRun = internalMutation({
  args: {
    setId: vv.id("exerciseSets"),
  },
  returns: vv.id("irtCalibrationRuns"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const set = await ctx.db.get("exerciseSets", args.setId);

    if (!set) {
      throw new Error("Exercise set not found for calibration.");
    }

    const latestRun = await ctx.db
      .query("irtCalibrationRuns")
      .withIndex("setId_startedAt", (q) => q.eq("setId", args.setId))
      .order("desc")
      .first();

    if (latestRun?.status === "running") {
      throw new Error("A calibration run is already in progress for this set.");
    }

    const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
      setId: args.setId,
      model: IRT_OPERATIONAL_MODEL,
      status: "running",
      questionCount: set.questionCount,
      responseCount: 0,
      attemptCount: 0,
      iterationCount: 0,
      maxParameterDelta: 0,
      startedAt: now,
      updatedAt: now,
    });

    await workflow.start(ctx, internal.irt.workflows.calibrateSetTwoPL, {
      calibrationRunId,
      setId: args.setId,
    });

    return calibrationRunId;
  },
});

/**
 * Persist calibrated item parameters and mark the run completed.
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
      throw new Error("Calibration run not found.");
    }

    for (const item of args.result.items) {
      const existingParams = await ctx.db
        .query("exerciseItemParameters")
        .withIndex("questionId", (q) => q.eq("questionId", item.questionId))
        .unique();

      const nextValues = {
        setId: run.setId,
        difficulty: item.difficulty,
        discrimination: item.discrimination,
        guessing: item.guessing,
        responseCount: item.responseCount,
        correctRate: item.correctRate,
        calibratedAt: now,
        calibrationStatus: item.calibrationStatus,
        calibrationRunId: args.calibrationRunId,
      };

      if (existingParams) {
        await ctx.db.patch(
          "exerciseItemParameters",
          existingParams._id,
          nextValues
        );
      } else {
        await ctx.db.insert("exerciseItemParameters", {
          questionId: item.questionId,
          ...nextValues,
        });
      }
    }

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

    return null;
  },
});

/**
 * Mark a calibration run as failed.
 */
export const failCalibrationRun = internalMutation({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("irtCalibrationRuns", args.calibrationRunId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });

    return null;
  },
});
