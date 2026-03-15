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
    return { kind: "not-ready" };
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
      return { kind: "unchanged", scaleVersionId: latestScaleVersion._id };
    }
  }

  const scaleVersionId = await publishScaleVersion(ctx.db, {
    tryoutId: tryout._id,
    questionCount: snapshot.questionCount,
    items: snapshot.items,
    publishedAt: Date.now(),
  });

  return { kind: "published", scaleVersionId };
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
        ctx.db
          .query("irtCalibrationQueue")
          .withIndex("setId_enqueuedAt", (q) => q.eq("setId", setId))
          .collect(),
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

    const existingParams = await ctx.db
      .query("exerciseItemParameters")
      .withIndex("setId", (q) => q.eq("setId", run.setId))
      .collect();
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

    const affectedTryoutSets = await ctx.db
      .query("snbtTryoutSets")
      .withIndex("setId", (q) => q.eq("setId", run.setId))
      .collect();

    await asyncMap(
      [...new Set(affectedTryoutSets.map((tryoutSet) => tryoutSet.tryoutId))],
      async (tryoutId) => {
        const existingQueueEntry = await ctx.db
          .query("irtScalePublicationQueue")
          .withIndex("tryoutId_enqueuedAt", (q) => q.eq("tryoutId", tryoutId))
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

    return null;
  },
});

/**
 * Mark a calibration run as failed and keep it eligible for retry.
 */
export const failCalibrationRun = internalMutation({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("irtCalibrationRuns", args.calibrationRunId);

    if (!run) {
      throw new Error("Calibration run not found.");
    }

    await ctx.db.patch("irtCalibrationRuns", args.calibrationRunId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });

    const existingQueueEntry = await ctx.db
      .query("irtCalibrationQueue")
      .withIndex("setId_enqueuedAt", (q) => q.eq("setId", run.setId))
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

    for (const tryoutId of distinctTryoutIds) {
      const tryoutQueueEntries = await ctx.db
        .query("irtScalePublicationQueue")
        .withIndex("tryoutId_enqueuedAt", (q) => q.eq("tryoutId", tryoutId))
        .collect();

      const result = await publishTryoutScaleVersionIfNeeded(ctx, tryoutId);

      if (result.kind === "not-ready") {
        continue;
      }

      await asyncMap(tryoutQueueEntries, (entry) =>
        ctx.db.delete("irtScalePublicationQueue", entry._id)
      );
    }

    return null;
  },
});
