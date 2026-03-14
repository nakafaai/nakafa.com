import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  IRT_CALIBRATION_QUEUE_BATCH_SIZE,
  IRT_MAX_CALIBRATION_STALENESS_MS,
  IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION,
  IRT_OPERATIONAL_MODEL,
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import {
  getLatestScaleVersionForTryout,
  getPublishableScaleSnapshot,
  getScaleVersionItems,
  hasPublishedScaleChanged,
  publishScaleVersion,
} from "@repo/backend/convex/irt/scaleVersions";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getManyFrom } from "convex-helpers/server/relationships";

async function startCalibrationRunWorkflow(
  ctx: MutationCtx,
  setId: Id<"exerciseSets">
) {
  const now = Date.now();
  const set = await ctx.db.get("exerciseSets", setId);

  if (!set) {
    throw new Error("Exercise set not found for calibration.");
  }

  const latestRun = await ctx.db
    .query("irtCalibrationRuns")
    .withIndex("setId_startedAt", (q) => q.eq("setId", setId))
    .order("desc")
    .first();

  if (latestRun?.status === "running") {
    return null;
  }

  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    setId,
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
    setId,
  });

  return calibrationRunId;
}

async function publishTryoutScaleVersionIfNeeded(
  ctx: MutationCtx,
  tryoutId: Id<"snbtTryouts">
) {
  const tryout = await ctx.db.get("snbtTryouts", tryoutId);

  if (!tryout) {
    throw new Error("Tryout not found for scale publication.");
  }

  const snapshot = await getPublishableScaleSnapshot(ctx.db, tryout._id);

  if (!snapshot) {
    return null;
  }

  const latestScaleVersion = await getLatestScaleVersionForTryout(
    ctx.db,
    tryout._id
  );

  if (latestScaleVersion) {
    const latestScaleItems = await getScaleVersionItems(
      ctx.db,
      latestScaleVersion._id
    );

    if (
      !hasPublishedScaleChanged({
        publishedItems: latestScaleItems,
        snapshotItems: snapshot.items,
      })
    ) {
      return latestScaleVersion._id;
    }
  }

  return publishScaleVersion(ctx.db, {
    tryoutId: tryout._id,
    questionCount: snapshot.questionCount,
    items: snapshot.items,
    publishedAt: Date.now(),
  });
}

/**
 * Drain a bounded batch of queued set calibrations.
 */
export const drainCalibrationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const queueEntries = await ctx.db
      .query("irtCalibrationQueue")
      .withIndex("enqueuedAt")
      .take(
        IRT_CALIBRATION_QUEUE_BATCH_SIZE *
          IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION
      );

    const distinctSetIds = [
      ...new Set(queueEntries.map((entry) => entry.setId)),
    ].slice(0, IRT_CALIBRATION_QUEUE_BATCH_SIZE);

    await asyncMap(distinctSetIds, async (setId) => {
      const [setQueueEntries, latestRun] = await Promise.all([
        getManyFrom(
          ctx.db,
          "irtCalibrationQueue",
          "setId_enqueuedAt",
          setId,
          "setId"
        ),
        ctx.db
          .query("irtCalibrationRuns")
          .withIndex("setId_startedAt", (q) => q.eq("setId", setId))
          .order("desc")
          .first(),
      ]);

      if (latestRun?.status === "running") {
        return null;
      }

      const newestSuccessfulRunAt =
        latestRun?.status === "completed"
          ? (latestRun.completedAt ?? latestRun.updatedAt)
          : undefined;
      const hasEnoughCompletedAttempts =
        setQueueEntries.length >= IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION;
      const isStale =
        newestSuccessfulRunAt === undefined ||
        now - newestSuccessfulRunAt >= IRT_MAX_CALIBRATION_STALENESS_MS;

      if (!(hasEnoughCompletedAttempts || isStale)) {
        return null;
      }

      const calibrationRunId = await startCalibrationRunWorkflow(ctx, setId);

      if (!calibrationRunId) {
        return null;
      }

      await asyncMap(setQueueEntries, (entry) =>
        ctx.db.delete("irtCalibrationQueue", entry._id)
      );

      return calibrationRunId;
    });

    return null;
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

    const existingParams = await getManyFrom(
      ctx.db,
      "exerciseItemParameters",
      "setId",
      run.setId
    );
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
        guessing: item.guessing,
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
      } else {
        await ctx.db.insert("exerciseItemParameters", {
          questionId: item.questionId,
          ...nextValues,
        });
      }
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

    const affectedTryoutSets = await getManyFrom(
      ctx.db,
      "snbtTryoutSets",
      "setId",
      run.setId
    );

    await asyncMap(
      [...new Set(affectedTryoutSets.map((tryoutSet) => tryoutSet.tryoutId))],
      (tryoutId) =>
        ctx.db.insert("irtScalePublicationQueue", {
          tryoutId,
          enqueuedAt: now,
        })
    );

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

/**
 * Drain a bounded batch of queued tryout scale publications.
 */
export const drainScalePublicationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const queueEntries = await ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("enqueuedAt")
      .take(IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE);

    const distinctTryoutIds = [
      ...new Set(queueEntries.map((entry) => entry.tryoutId)),
    ];

    await asyncMap(distinctTryoutIds, async (tryoutId) => {
      const tryoutQueueEntries = await getManyFrom(
        ctx.db,
        "irtScalePublicationQueue",
        "tryoutId_enqueuedAt",
        tryoutId,
        "tryoutId"
      );

      await publishTryoutScaleVersionIfNeeded(ctx, tryoutId);

      await asyncMap(tryoutQueueEntries, (entry) =>
        ctx.db.delete("irtScalePublicationQueue", entry._id)
      );

      return null;
    });

    return null;
  },
});
